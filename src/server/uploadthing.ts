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
      return {}
    })
    .onUploadComplete(async ({ file }) => {
      console.log('Upload complete for file:', file.ufsUrl)
      return { url: file.ufsUrl }
    }),
  voiceUploader: f({
    audio: {
      maxFileSize: '16MB',
      maxFileCount: 1,
    },
    blob: {
      maxFileSize: '16MB',
      maxFileCount: 1,
    },
  })
    .middleware(async () => {
      return {}
    })
    .onUploadComplete(async ({ file }) => {
      console.log('Voice upload complete for file:', file.ufsUrl)
      return { url: file.ufsUrl }
    }),
} satisfies FileRouter

export type OurFileRouter = typeof uploadRouter
