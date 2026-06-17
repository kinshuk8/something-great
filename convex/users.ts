import { query, mutation } from './_generated/server';
import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

export const getCurrentUser = query({
    args: {},
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        if (userId === null) {
            return null;
        }
        return await ctx.db.get(userId);
    },
});

export const updateProfile = mutation({
    args: {
        displayName: v.optional(v.string()),
        avatarSeed: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (userId === null) {
            throw new Error('Not authenticated');
        }

        const updates: Record<string, any> = {};
        if (args.displayName !== undefined) {
            if (!args.displayName.trim()) {
                throw new Error('Display name cannot be empty');
            }
            updates.displayName = args.displayName.trim();
        }
        if (args.avatarSeed !== undefined) {
            updates.avatarSeed = args.avatarSeed;
        }

        if (Object.keys(updates).length > 0) {
            await ctx.db.patch(userId, updates);
        }
    },
});