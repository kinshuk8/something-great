import { createFileRoute } from '@tanstack/react-router'
import { createRouteHandler } from 'uploadthing/server'
import { uploadRouter } from '../../server/uploadthing'

let token = process.env.UPLOADTHING_TOKEN
if (token) {
  token = token.trim()
  if (token.startsWith("'") && token.endsWith("'")) token = token.slice(1, -1)
  if (token.startsWith('"') && token.endsWith('"')) token = token.slice(1, -1)

  while (token.length % 4 !== 0) {
    token += '='
  }
  process.env.UPLOADTHING_TOKEN = token
}

const handler = createRouteHandler({
  router: uploadRouter,
})

const addCorsHeaders = (response: Response) => {
  const headers = new Headers(response.headers)
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Headers', '*')
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export const Route = createFileRoute('/api/uploadthing')({
  server: {
    handlers: {
      OPTIONS: async () => {
        const headers = new Headers()
        headers.set('Access-Control-Allow-Origin', '*')
        headers.set('Access-Control-Allow-Headers', '*')
        headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        return new Response(null, {
          status: 204,
          headers,
        })
      },
      GET: async ({ request }) => {
        const res = await handler(request)
        return addCorsHeaders(res)
      },
      POST: async ({ request }) => {
        const res = await handler(request)
        return addCorsHeaders(res)
      },
    },
  },
})
