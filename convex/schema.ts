import { defineSchema, defineTable } from 'convex/server';
import { authTables } from '@convex-dev/auth/server';
import { v } from 'convex/values';

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
    })
        .index('by_createdAt', ['createdAt']),
})