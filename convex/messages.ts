import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { getAuthUserId } from '@convex-dev/auth/server';

export const sendMessage = mutation({
    args: {
        body: v.string(),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (userId === null) {
            throw new Error('Not authenticated');
        }

        await ctx.db.insert('messages', {
            body: args.body,
            userId,
            createdAt: Date.now(),
        });
    },
});

export const getMessages = query({
    args: {},
    handler: async (ctx) => {
        const messages = await ctx.db
            .query('messages')
            .order('desc')
            .take(100);

        const reversed = messages.reverse();

        return Promise.all(
            reversed.map(async (message) => ({
                ...message,
                user: await ctx.db.get(message.userId),
            }))
        );
    },
});