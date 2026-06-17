import { mutation, query, internalMutation } from './_generated/server';
import { v } from 'convex/values';
import { getAuthUserId } from '@convex-dev/auth/server';

export const sendMessage = mutation({
    args: {
        body: v.optional(v.string()),
        imageUrl: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (userId === null) {
            throw new Error('Not authenticated');
        }

        if (!args.body && !args.imageUrl) {
            throw new Error('Message body or image is required');
        }

        await ctx.db.insert('messages', {
            body: args.body,
            imageUrl: args.imageUrl,
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

export const getAndCleanOldMessages = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const keysToDelete: string[] = [];

    // 1. Delete all messages older than 1 week
    const oldestMessages = await ctx.db
      .query("messages")
      .withIndex("by_createdAt", (q) => q.lt("createdAt", oneWeekAgo))
      .collect();

    for (const msg of oldestMessages) {
      if (msg.imageUrl) {
        const urlParts = msg.imageUrl.split("/");
        const key = urlParts[urlParts.length - 1];
        if (key) keysToDelete.push(key);
      }
      await ctx.db.delete(msg._id);
    }

    // 2. Clear or delete images in messages older than 24 hours (but newer than 1 week)
    const middleMessages = await ctx.db
      .query("messages")
      .withIndex("by_createdAt", (q) => q.gt("createdAt", oneWeekAgo).lt("createdAt", oneDayAgo))
      .collect();

    for (const msg of middleMessages) {
      if (msg.imageUrl) {
        const urlParts = msg.imageUrl.split("/");
        const key = urlParts[urlParts.length - 1];
        if (key) keysToDelete.push(key);

        if (msg.body) {
          // If message contains text body, just remove image reference
          await ctx.db.patch(msg._id, { imageUrl: undefined });
        } else {
          // If image only, delete the message completely
          await ctx.db.delete(msg._id);
        }
      }
    }

    return keysToDelete;
  },
});