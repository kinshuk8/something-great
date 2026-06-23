import { mutation, query, internalMutation } from './_generated/server'
import { v } from 'convex/values'
import { getAuthUserId } from '@convex-dev/auth/server'

export const sendMessage = mutation({
  args: {
    body: v.optional(v.string()),
    bodyIv: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    imageIv: v.optional(v.string()),
    audioUrl: v.optional(v.string()),
    audioIv: v.optional(v.string()),
    audioDuration: v.optional(v.number()),
    chatroomId: v.optional(v.union(v.id('chatrooms'), v.null())),
    replyToId: v.optional(v.id('messages')),
    mentions: v.optional(v.array(v.id('users'))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (userId === null) {
      throw new Error('Not authenticated')
    }

    if (!args.body && !args.imageUrl && !args.audioUrl) {
      throw new Error('Message body, image, or audio is required')
    }

    const chatroomId = args.chatroomId ?? null
    let seen: boolean | undefined = undefined

    if (chatroomId !== null) {
      const chatroom = await ctx.db.get(chatroomId)
      if (chatroom?.isDM) {
        seen = false
      }
    }

    const messageId = await ctx.db.insert('messages', {
      body: args.body,
      bodyIv: args.bodyIv,
      imageUrl: args.imageUrl,
      imageIv: args.imageIv,
      audioUrl: args.audioUrl,
      audioIv: args.audioIv,
      audioDuration: args.audioDuration,
      seen,
      userId,
      createdAt: Date.now(),
      chatroomId,
      replyToId: args.replyToId,
      mentions: args.mentions,
    })

    // Update chatroom lastMessageAt timestamp for sorting
    if (chatroomId !== null) {
      await ctx.db.patch(chatroomId, {
        lastMessageAt: Date.now(),
      })
    }

    return messageId
  },
})

export const getMessages = query({
  args: {
    chatroomId: v.optional(v.union(v.id('chatrooms'), v.null())),
  },
  handler: async (ctx, args) => {
    const chatroomId = args.chatroomId ?? null

    // Perform index scan to only read messages from target room
    const messages = await ctx.db
      .query('messages')
      .withIndex('by_chatroomId_and_createdAt', (q) =>
        q.eq('chatroomId', chatroomId),
      )
      .order('desc')
      .take(100)

    const reversed = messages.reverse()

    return Promise.all(
      reversed.map(async (message) => {
        const user = await ctx.db.get(message.userId)

        let repliedTo = null
        if (message.replyToId) {
          const replyMsg = await ctx.db.get(message.replyToId)
          if (replyMsg) {
            const replyUser = await ctx.db.get(replyMsg.userId)
            repliedTo = {
              ...replyMsg,
              user: replyUser,
            }
          }
        }

        return {
          ...message,
          user,
          repliedTo,
        }
      }),
    )
  },
})

export const getAndCleanOldMessages = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000

    const keysToDelete: string[] = []

    // 1. Delete all messages older than 30 days
    const oldestMessages = await ctx.db
      .query('messages')
      .withIndex('by_createdAt', (q) => q.lt('createdAt', thirtyDaysAgo))
      .collect()

    for (const msg of oldestMessages) {
      if (msg.imageUrl) {
        const urlParts = msg.imageUrl.split('/')
        const key = urlParts[urlParts.length - 1]
        if (key) keysToDelete.push(key)
      }
      await ctx.db.delete(msg._id)
    }

    // 2. Clear or delete images in messages older than 7 days (but newer than 30 days)
    const middleMessages = await ctx.db
      .query('messages')
      .withIndex('by_createdAt', (q) =>
        q.gt('createdAt', thirtyDaysAgo).lt('createdAt', sevenDaysAgo),
      )
      .collect()

    for (const msg of middleMessages) {
      if (msg.imageUrl) {
        const urlParts = msg.imageUrl.split('/')
        const key = urlParts[urlParts.length - 1]
        if (key) keysToDelete.push(key)

        // Keep the message in history but remove the image and set the expiration reason
        await ctx.db.patch(msg._id, {
          imageUrl: undefined,
          imageDeletedReason: 'expired',
        })
      }
    }

    return keysToDelete
  },
})

export const deleteImageReference = internalMutation({
  args: {
    messageId: v.id('messages'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (userId === null) {
      throw new Error('Not authenticated')
    }

    const message = await ctx.db.get(args.messageId)
    if (!message) {
      throw new Error('Message not found')
    }

    if (message.userId !== userId) {
      throw new Error('Not authorized to delete this image')
    }

    if (!message.imageUrl) {
      return null
    }

    const urlParts = message.imageUrl.split('/')
    const key = urlParts[urlParts.length - 1]

    if (message.body) {
      // Keep the text message but remove the image URL reference
      await ctx.db.patch(message._id, { imageUrl: undefined })
    } else {
      // If there is no text body, delete the entire message
      await ctx.db.delete(message._id)
    }

    return key
  },
})

export const deleteMessageAndGetFiles = internalMutation({
  args: {
    messageId: v.id('messages'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (userId === null) {
      throw new Error('Not authenticated')
    }

    const message = await ctx.db.get(args.messageId)
    if (!message) {
      throw new Error('Message not found')
    }

    if (message.userId !== userId) {
      throw new Error('Not authorized to delete this message')
    }

    const keysToDelete: string[] = []

    // Get image key if it is an UploadThing URL
    if (message.imageUrl) {
      const isUploadThing =
        message.imageUrl.includes('utfs.io') ||
        message.imageUrl.includes('ufs.sh') ||
        message.imageUrl.includes('uploadthing.com')
      if (isUploadThing) {
        const urlParts = message.imageUrl.split('/')
        const key = urlParts[urlParts.length - 1]
        if (key) keysToDelete.push(key)
      }
    }

    // Get audio key if it exists
    if (message.audioUrl) {
      const urlParts = message.audioUrl.split('/')
      const key = urlParts[urlParts.length - 1]
      if (key) keysToDelete.push(key)
    }

    let deletedFormat = 'text'
    if (message.audioUrl) {
      deletedFormat = 'voice'
    } else if (message.imageUrl) {
      const isGiphy = !message.imageIv || message.imageUrl.includes('giphy.com')
      deletedFormat = isGiphy ? 'gif' : 'image'
    }

    await ctx.db.replace(message._id, {
      userId: message.userId,
      createdAt: message.createdAt,
      chatroomId: message.chatroomId,
      isDeleted: true,
      deletedFormat,
    })

    return keysToDelete
  },
})

export const backfillMessages = mutation({
  args: {},
  handler: async (ctx) => {
    const messages = await ctx.db.query('messages').collect()
    let count = 0
    for (const msg of messages) {
      if (msg.chatroomId === undefined) {
        await ctx.db.patch(msg._id, { chatroomId: null })
        count++
      }
    }
    return count
  },
})

export const markMessagesAsSeen = mutation({
  args: {
    chatroomId: v.id('chatrooms'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (userId === null) {
      throw new Error('Not authenticated')
    }

    const chatroom = await ctx.db.get(args.chatroomId)
    if (!chatroom || !chatroom.isDM) {
      return
    }

    const messages = await ctx.db
      .query('messages')
      .withIndex('by_chatroomId_and_createdAt', (q) =>
        q.eq('chatroomId', args.chatroomId),
      )
      .order('desc')
      .take(100)

    for (const msg of messages) {
      if (msg.userId !== userId && !msg.seen) {
        await ctx.db.patch(msg._id, { seen: true })
      }
    }
  },
})
