import { createFileRoute } from '@tanstack/react-router'
import { createRouteHandler } from 'uploadthing/server'
import { uploadRouter } from '../../server/uploadthing'

const handler = createRouteHandler({
  router: uploadRouter,
})

export const Route = createFileRoute('/api/uploadthing')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        return await handler(request)
      },
      POST: async ({ request }) => {
        return await handler(request)
      },
    },
  },
})
