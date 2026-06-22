import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { getAuthUserId } from '@convex-dev/auth/server'

// 1. Register or update the authenticated user's public ECDH key (JWK representation) along with optional encrypted private key backup
export const registerPublicKey = mutation({
  args: {
    publicKey: v.string(),
    encryptedPrivateKey: v.optional(v.string()),
    backupIv: v.optional(v.string()),
    backupSalt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (userId === null) {
      throw new Error('Not authenticated')
    }

    const existing = await ctx.db
      .query('userPublicKeys')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique()

    const fields = {
      publicKey: args.publicKey,
      encryptedPrivateKey: args.encryptedPrivateKey,
      backupIv: args.backupIv,
      backupSalt: args.backupSalt,
    }

    if (existing) {
      await ctx.db.patch(existing._id, fields)
      return existing._id
    } else {
      return await ctx.db.insert('userPublicKeys', {
        userId,
        ...fields,
      })
    }
  },
})

// Query to get the authenticated user's key backup details
export const getMyBackupDetails = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (userId === null) {
      return null
    }

    const record = await ctx.db
      .query('userPublicKeys')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique()

    return record || null
  },
})

// 2. Fetch public key of a specific user
export const getUserPublicKey = query({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const myUserId = await getAuthUserId(ctx)
    if (myUserId === null) {
      throw new Error('Not authenticated')
    }

    const record = await ctx.db
      .query('userPublicKeys')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .unique()

    return record ? record.publicKey : null
  },
})

// 3. Batch fetch public keys for a list of users (e.g., when adding members to a room)
export const getUserPublicKeys = query({
  args: {
    userIds: v.array(v.id('users')),
  },
  handler: async (ctx, args) => {
    const myUserId = await getAuthUserId(ctx)
    if (myUserId === null) {
      throw new Error('Not authenticated')
    }

    const results = []
    for (const userId of args.userIds) {
      const record = await ctx.db
        .query('userPublicKeys')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .unique()
      if (record) {
        results.push({
          userId,
          publicKey: record.publicKey,
        })
      }
    }
    return results
  },
})

// 4. Store encrypted room keys for chatroom members
export const storeRoomKeys = mutation({
  args: {
    chatroomId: v.id('chatrooms'),
    keys: v.array(
      v.object({
        userId: v.id('users'),
        encryptedKey: v.string(),
        iv: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (userId === null) {
      throw new Error('Not authenticated')
    }

    const room = await ctx.db.get(args.chatroomId)
    if (!room) {
      throw new Error('Chatroom not found')
    }

    // Verify current user is a member of the room
    if (!room.memberIds.includes(userId)) {
      throw new Error('Unauthorized: Not a room member')
    }

    // Upsert the keys
    for (const keyInfo of args.keys) {
      // Ensure the recipient is a member of the room
      if (!room.memberIds.includes(keyInfo.userId)) {
        continue // Skip non-members
      }

      const existing = await ctx.db
        .query('roomKeys')
        .withIndex('by_chatroomId_and_userId', (q) =>
          q.eq('chatroomId', args.chatroomId).eq('userId', keyInfo.userId),
        )
        .unique()

      if (existing) {
        await ctx.db.patch(existing._id, {
          encryptedKey: keyInfo.encryptedKey,
          iv: keyInfo.iv,
        })
      } else {
        await ctx.db.insert('roomKeys', {
          chatroomId: args.chatroomId,
          userId: keyInfo.userId,
          encryptedKey: keyInfo.encryptedKey,
          iv: keyInfo.iv,
        })
      }
    }
  },
})

// 5. Get the encrypted room key for the authenticated user for a specific chatroom
export const getRoomKey = query({
  args: {
    chatroomId: v.id('chatrooms'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (userId === null) {
      return null
    }

    return await ctx.db
      .query('roomKeys')
      .withIndex('by_chatroomId_and_userId', (q) =>
        q.eq('chatroomId', args.chatroomId).eq('userId', userId),
      )
      .unique()
  },
})
