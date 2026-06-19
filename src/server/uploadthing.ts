import { createUploadthing } from 'uploadthing/server'
import type { FileRouter } from 'uploadthing/server'

const f = createUploadthing()

export const uploadRouter = {
  imageUploader: f({
    image: {
      maxFileSize: '16MB',
      maxFileCount: 1,
    },
  })
    .middleware(async () => {
      // This runs on server before upload
      return {}
    })
    .onUploadComplete(async ({ file }) => {
      // This runs on server after upload is successful
      console.log('Upload complete for file:', file.ufsUrl)
      return { url: file.ufsUrl }
    }),
} satisfies FileRouter

export type OurFileRouter = typeof uploadRouter
