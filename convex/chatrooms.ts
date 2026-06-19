import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { getAuthUserId } from '@convex-dev/auth/server'

export const createChatroom = mutation({
  args: {
    name: v.string(),
    password: v.optional(v.string()),
    isPrivate: v.boolean(),
    isDM: v.optional(v.boolean()),
    initialMembers: v.optional(v.array(v.id('users'))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (userId === null) {
      throw new Error('Not authenticated')
    }

    const memberIds = [userId]
    if (args.initialMembers) {
      for (const memberId of args.initialMembers) {
        if (!memberIds.includes(memberId)) {
          memberIds.push(memberId)
        }
      }
    }

    const chatroomId = await ctx.db.insert('chatrooms', {
      name: args.name,
      password: args.password || undefined,
      ownerId: userId,
      memberIds,
      isPrivate: args.isPrivate,
      isDM: args.isDM || false,
      lastMessageAt: Date.now(),
    })

    return chatroomId
  },
})

export const getChatrooms = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (userId === null) return []

    const chatrooms = await ctx.db.query('chatrooms').collect()

    // Filter and map in memory
    const userChatrooms = chatrooms.filter((room) =>
      room.memberIds.includes(userId),
    )

    return Promise.all(
      userChatrooms.map(async (room) => {
        let displayName = room.name
        let otherUser = null

        if (room.isDM) {
          // Find the other member in the DM
          const otherId = room.memberIds.find((id) => id !== userId)
          if (otherId) {
            const user = await ctx.db.get(otherId)
            if (user) {
              displayName = user.displayName || user.name || 'Anonymous'
              otherUser = user
            }
          }
        }

        return {
          _id: room._id,
          _creationTime: room._creationTime,
          name: displayName,
          ownerId: room.ownerId,
          isPrivate: room.isPrivate,
          isDM: room.isDM,
          lastMessageAt: room.lastMessageAt,
          memberIds: room.memberIds,
          hasPassword: !!room.password,
          otherUser,
        }
      }),
    )
  },
})

export const getDiscoverableChatrooms = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (userId === null) return []

    const chatrooms = await ctx.db.query('chatrooms').collect()

    // Show rooms that are:
    // 1. Not private (isPrivate === false)
    // 2. Not DMs (isDM === false)
    // 3. User is not yet a member
    const discoverable = chatrooms.filter(
      (room) =>
        !room.isPrivate && !room.isDM && !room.memberIds.includes(userId),
    )

    return discoverable.map((room) => ({
      _id: room._id,
      _creationTime: room._creationTime,
      name: room.name,
      ownerId: room.ownerId,
      isPrivate: room.isPrivate,
      hasPassword: !!room.password,
      memberIds: room.memberIds,
    }))
  },
})

export const joinChatroom = mutation({
  args: {
    chatroomId: v.id('chatrooms'),
    password: v.optional(v.string()),
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

    if (room.memberIds.includes(userId)) {
      return room._id // Already a member
    }

    if (room.isPrivate) {
      throw new Error('This room is invite-only')
    }

    if (room.password) {
      if (!args.password || room.password !== args.password) {
        throw new Error('Incorrect password')
      }
    }

    // Add user to members
    const updatedMembers = [...room.memberIds, userId]
    await ctx.db.patch(args.chatroomId, {
      memberIds: updatedMembers,
    })

    return room._id
  },
})

export const addMembers = mutation({
  args: {
    chatroomId: v.id('chatrooms'),
    userIds: v.array(v.id('users')),
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

    // Verify sender is already a member
    if (!room.memberIds.includes(userId)) {
      throw new Error('Unauthorized')
    }

    const updatedMembers = [...room.memberIds]
    let changed = false

    for (const id of args.userIds) {
      if (!updatedMembers.includes(id)) {
        updatedMembers.push(id)
        changed = true
      }
    }

    if (changed) {
      await ctx.db.patch(args.chatroomId, {
        memberIds: updatedMembers,
      })
    }

    return room._id
  },
})

export const checkOrCreateDM = mutation({
  args: {
    friendId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (userId === null) {
      throw new Error('Not authenticated')
    }

    // Look for existing DM
    const rooms = await ctx.db.query('chatrooms').collect()
    const existingDM = rooms.find(
      (room) =>
        room.isDM &&
        room.memberIds.length === 2 &&
        room.memberIds.includes(userId) &&
        room.memberIds.includes(args.friendId),
    )

    if (existingDM) {
      return existingDM._id
    }

    // Create new DM
    const chatroomId = await ctx.db.insert('chatrooms', {
      name: '', // Empty name for DMs, will resolve dynamically
      ownerId: userId,
      memberIds: [userId, args.friendId],
      isPrivate: true,
      isDM: true,
      lastMessageAt: Date.now(),
    })

    return chatroomId
  },
})
