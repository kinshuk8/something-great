'use node'

import { internalAction, action } from './_generated/server'
import { UTApi } from 'uploadthing/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'

export const runCleanup = internalAction({
  args: {},
  handler: async (ctx) => {
    // 1. Fetch old messages and delete them from DB, returning UploadThing keys
    const keysToDelete: string[] = await ctx.runMutation(
      internal.messages.getAndCleanOldMessages,
    )

    if (keysToDelete.length === 0) {
      console.log('No files to delete from UploadThing.')
      return
    }

    console.log(
      `Deleting ${keysToDelete.length} files from UploadThing...`,
      keysToDelete,
    )

    // 2. Delete files from UploadThing using UTApi
    const token = process.env.UPLOADTHING_TOKEN
    if (!token) {
      console.error('UPLOADTHING_TOKEN env variable is missing on Convex!')
      return
    }

    try {
      const utapi = new UTApi({ token })
      const response = await utapi.deleteFiles(keysToDelete)
      console.log('UploadThing deletion response:', response)
    } catch (error) {
      console.error('Failed to delete files from UploadThing:', error)
    }
  },
})

export const deleteImage = action({
  args: {
    messageId: v.id('messages'),
  },
  handler: async (ctx, args) => {
    // 1. Run internal mutation to authorize, delete db entry, and return key
    const key = await ctx.runMutation(internal.messages.deleteImageReference, {
      messageId: args.messageId,
    })

    if (!key) {
      console.log('No file key found to delete from UploadThing.')
      return
    }

    console.log(`Deleting file ${key} from UploadThing...`)

    // 2. Delete the file from UploadThing
    const token = process.env.UPLOADTHING_TOKEN
    if (!token) {
      console.error('UPLOADTHING_TOKEN env variable is missing on Convex!')
      return
    }

    try {
      const utapi = new UTApi({ token })
      const response = await utapi.deleteFiles(key)
      console.log('UploadThing deletion response:', response)
    } catch (error) {
      console.error('Failed to delete file from UploadThing:', error)
    }
  },
})

export const deleteMessage = action({
  args: {
    messageId: v.id('messages'),
  },
  handler: async (ctx, args) => {
    const keys = await ctx.runMutation(
      internal.messages.deleteMessageAndGetFiles,
      {
        messageId: args.messageId,
      },
    )

    if (keys.length === 0) {
      console.log('No file keys found to delete from UploadThing.')
      return
    }

    console.log(`Deleting files ${keys.join(', ')} from UploadThing...`)

    const token = process.env.UPLOADTHING_TOKEN
    if (!token) {
      console.error('UPLOADTHING_TOKEN env variable is missing on Convex!')
      return
    }

    try {
      const utapi = new UTApi({ token })
      const response = await utapi.deleteFiles(keys)
      console.log('UploadThing deletion response:', response)
    } catch (error) {
      console.error('Failed to delete files from UploadThing:', error)
    }
  },
})
