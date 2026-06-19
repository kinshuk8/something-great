import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { getAuthUserId } from '@convex-dev/auth/server'

export const sendFriendRequest = mutation({
  args: { receiverId: v.id('users') },
  handler: async (ctx, args) => {
    const senderId = await getAuthUserId(ctx)
    if (senderId === null) {
      throw new Error('Not authenticated')
    }
    if (senderId === args.receiverId) {
      throw new Error('Cannot add yourself')
    }

    // Check if there is already a friend request sent from us
    const existing = await ctx.db
      .query('friendRequests')
      .withIndex('by_senderId_and_receiverId', (q) =>
        q.eq('senderId', senderId).eq('receiverId', args.receiverId),
      )
      .unique()
    if (existing) {
      throw new Error('Request already sent')
    }

    // Check if they have already sent us a request
    const existingReverse = await ctx.db
      .query('friendRequests')
      .withIndex('by_senderId_and_receiverId', (q) =>
        q.eq('senderId', args.receiverId).eq('receiverId', senderId),
      )
      .unique()
    if (existingReverse) {
      // Automatically accept it!
      await ctx.db.patch(existingReverse._id, { status: 'accepted' })
      return
    }

    await ctx.db.insert('friendRequests', {
      senderId,
      receiverId: args.receiverId,
      status: 'pending',
    })
  },
})

export const respondToFriendRequest = mutation({
  args: { requestId: v.id('friendRequests'), status: v.string() }, // "accepted" | "declined"
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (userId === null) {
      throw new Error('Not authenticated')
    }
    const req = await ctx.db.get(args.requestId)
    if (!req) {
      throw new Error('Request not found')
    }
    if (req.receiverId !== userId) {
      throw new Error('Unauthorized')
    }

    if (args.status === 'accepted') {
      await ctx.db.patch(args.requestId, { status: 'accepted' })
    } else {
      await ctx.db.delete(args.requestId)
    }
  },
})

export const cancelFriendRequest = mutation({
  args: { requestId: v.id('friendRequests') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (userId === null) {
      throw new Error('Not authenticated')
    }
    const req = await ctx.db.get(args.requestId)
    if (!req) {
      throw new Error('Request not found')
    }
    if (req.senderId !== userId) {
      throw new Error('Unauthorized')
    }
    await ctx.db.delete(args.requestId)
  },
})

export const unfriend = mutation({
  args: { friendId: v.id('users') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (userId === null) {
      throw new Error('Not authenticated')
    }

    const req1 = await ctx.db
      .query('friendRequests')
      .withIndex('by_senderId_and_receiverId', (q) =>
        q.eq('senderId', userId).eq('receiverId', args.friendId),
      )
      .unique()
    if (req1) {
      await ctx.db.delete(req1._id)
      return
    }

    const req2 = await ctx.db
      .query('friendRequests')
      .withIndex('by_senderId_and_receiverId', (q) =>
        q.eq('senderId', args.friendId).eq('receiverId', userId),
      )
      .unique()
    if (req2) {
      await ctx.db.delete(req2._id)
      return
    }
  },
})

export const getFriendRequests = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (userId === null) return []
    const reqs = await ctx.db
      .query('friendRequests')
      .withIndex('by_receiverId_and_status', (q) =>
        q.eq('receiverId', userId).eq('status', 'pending'),
      )
      .collect()
    return Promise.all(
      reqs.map(async (req) => {
        const sender = await ctx.db.get(req.senderId)
        return {
          ...req,
          sender,
        }
      }),
    )
  },
})

export const getSentRequests = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (userId === null) return []
    const reqs = await ctx.db
      .query('friendRequests')
      .withIndex('by_senderId_and_status', (q) =>
        q.eq('senderId', userId).eq('status', 'pending'),
      )
      .collect()
    return Promise.all(
      reqs.map(async (req) => {
        const receiver = await ctx.db.get(req.receiverId)
        return {
          ...req,
          receiver,
        }
      }),
    )
  },
})

export const getFriends = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (userId === null) return []

    const reqsReceived = await ctx.db
      .query('friendRequests')
      .withIndex('by_receiverId_and_status', (q) =>
        q.eq('receiverId', userId).eq('status', 'accepted'),
      )
      .collect()
    const friendsFromReceived = await Promise.all(
      reqsReceived.map(async (req) => {
        const friend = await ctx.db.get(req.senderId)
        return { friend, requestId: req._id }
      }),
    )

    const reqsSent = await ctx.db
      .query('friendRequests')
      .withIndex('by_senderId_and_status', (q) =>
        q.eq('senderId', userId).eq('status', 'accepted'),
      )
      .collect()
    const friendsFromSent = await Promise.all(
      reqsSent.map(async (req) => {
        const friend = await ctx.db.get(req.receiverId)
        return { friend, requestId: req._id }
      }),
    )

    const combined = [...friendsFromReceived, ...friendsFromSent]
    return combined.filter((f) => f.friend !== null)
  },
})
