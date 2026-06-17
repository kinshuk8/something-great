import { createFileRoute } from '@tanstack/react-router'
import { createRouteHandler } from 'uploadthing/server'
import { uploadRouter } from '../../server/uploadthing'

// Automatically fix UPLOADTHING_TOKEN formatting issues (missing padding, quotes)
let token = process.env.UPLOADTHING_TOKEN;
if (token) {
  token = token.trim();
  if (token.startsWith("'") && token.endsWith("'")) token = token.slice(1, -1);
  if (token.startsWith('"') && token.endsWith('"')) token = token.slice(1, -1);
  
  // Add missing base64 padding '=' if it was truncated
  while (token.length % 4 !== 0) {
    token += '=';
  }
  process.env.UPLOADTHING_TOKEN = token;
}

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
