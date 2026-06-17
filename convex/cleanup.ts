"use node";

import { internalAction } from "./_generated/server";
import { UTApi } from "uploadthing/server";
import { internal } from "./_generated/api";

export const runCleanup = internalAction({
  args: {},
  handler: async (ctx) => {
    // 1. Fetch old messages and delete them from DB, returning UploadThing keys
    const keysToDelete: string[] = await ctx.runMutation(
      internal.messages.getAndCleanOldMessages
    );

    if (keysToDelete.length === 0) {
      console.log("No files to delete from UploadThing.");
      return;
    }

    console.log(`Deleting ${keysToDelete.length} files from UploadThing...`, keysToDelete);

    // 2. Delete files from UploadThing using UTApi
    const token = process.env.UPLOADTHING_TOKEN;
    if (!token) {
      console.error("UPLOADTHING_TOKEN env variable is missing on Convex!");
      return;
    }

    try {
      const utapi = new UTApi({ token });
      const response = await utapi.deleteFiles(keysToDelete);
      console.log("UploadThing deletion response:", response);
    } catch (error) {
      console.error("Failed to delete files from UploadThing:", error);
    }
  },
});
