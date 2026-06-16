import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { useAuthActions, useConvexAuth } from '@convex-dev/auth/react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { api } from '../../convex/_generated/api'
import { getAvatar } from '#/lib/avatar'

export const Route = createFileRoute('/chat')({
  component: RouteComponent,
})

function RouteComponent() {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const { signOut } = useAuthActions()
  const router = useRouter()
  const [body, setBody] = useState('')

  const messages = useQuery(api.messages.getMessages)
  const sendMessage = useMutation(api.messages.sendMessage)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="font-mono text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center gap-4">
        <p className="font-mono">You need to sign in to access the chat.</p>
        <Button onClick={() => router.navigate({ to: '/signin' })}>
          Sign In
        </Button>
      </div>
    )
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim()) return
    await sendMessage({ body: body.trim() })
    setBody('')
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <h1 className="font-mono text-xl font-bold">Global Chat</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground font-mono">Public Room</span>
            <Button
              variant="link"
              onClick={() => signOut()}
              className="text-muted-foreground hover:text-foreground text-sm font-mono"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages === undefined ? (
            <p className="text-center text-muted-foreground font-mono">Loading messages...</p>
          ) : messages.length === 0 ? (
            <p className="text-center text-muted-foreground font-mono mt-16">No messages yet. Be the first to say something!</p>
          ) : (
            messages.map((msg) => (
              <div key={msg._id} className="flex items-start gap-3">
                <img
                  src={msg.user ? getAvatar(msg.user.avatarSeed) : getAvatar('default')}
                  alt="avatar"
                  className="w-8 h-8 rounded-full mt-0.5 shrink-0"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-mono font-semibold text-foreground">
                    {msg.user?.displayName || msg.user?.name || 'Anonymous'}
                  </span>
                  <p className="text-foreground font-mono text-sm leading-relaxed">
                    {msg.body}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Input Bar */}
      <div className="border-t border-border px-4 py-4">
        <form onSubmit={handleSend} className="max-w-3xl mx-auto flex items-center gap-2">
          <Button
            type="button"
            disabled
            className="shrink-0 rounded-lg bg-muted text-muted-foreground hover:bg-muted-foreground hover:text-background transition-colors duration-200 cursor-not-allowed"
            title="Image upload (coming soon)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </Button>
          <Input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 rounded-lg bg-card border-border px-4 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <Button
            type="submit"
            disabled={!body.trim()}
            className="shrink-0 rounded-lg bg-foreground text-background px-4 py-2 font-mono text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            Send
          </Button>
        </form>
      </div>
    </div>
  )
}