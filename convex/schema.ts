import { defineSchema, defineTable } from 'convex/server'
import { authTables } from '@convex-dev/auth/server'
import { v } from 'convex/values'

export default defineSchema({
  ...authTables,
  // Override users table to add custom app fields
  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    image: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    // Custom app fields
    displayName: v.string(),
    username: v.string(),
    avatarSeed: v.string(),
  })
    .index('email', ['email'])
    .index('phone', ['phone'])
    .index('by_username', ['username']),

  messages: defineTable({
    userId: v.id('users'),
    body: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    createdAt: v.number(),
    chatroomId: v.optional(v.union(v.id('chatrooms'), v.null())),
    replyToId: v.optional(v.id('messages')),
    mentions: v.optional(v.array(v.id('users'))),
  })
    .index('by_createdAt', ['createdAt'])
    .index('by_chatroomId_and_createdAt', ['chatroomId', 'createdAt']),

  chatrooms: defineTable({
    name: v.string(),
    ownerId: v.id('users'),
    password: v.optional(v.string()),
    memberIds: v.array(v.id('users')),
    isPrivate: v.boolean(),
    isDM: v.optional(v.boolean()),
    lastMessageAt: v.optional(v.number()),
  }),

  friendRequests: defineTable({
    senderId: v.id('users'),
    receiverId: v.id('users'),
    status: v.string(), // "pending" | "accepted" | "declined"
  })
    .index('by_senderId_and_receiverId', ['senderId', 'receiverId'])
    .index('by_receiverId_and_status', ['receiverId', 'status'])
    .index('by_senderId_and_status', ['senderId', 'status']),
})
