import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { Button } from '../components/ui/button'
import { useConvexAuth, useAuthActions } from '@convex-dev/auth/react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { getAvatar } from '#/lib/avatar'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const { signOut } = useAuthActions()
  const router = useRouter()
  const currentUser = useQuery(api.users.getCurrentUser)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="font-mono text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (isAuthenticated && currentUser !== undefined) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center relative overflow-hidden px-4">
        <div className="relative z-10 flex flex-col items-center gap-6 max-w-lg w-full">
          <img
            src={getAvatar(currentUser?.avatarSeed || 'default')}
            alt="avatar"
            className="w-16 h-16 rounded-full border border-border"
          />
          <div className="flex flex-col items-center gap-1">
            <h1 className="text-xl font-semibold font-mono tracking-tight">
              Welcome back{currentUser?.displayName ? `, ${currentUser.displayName}` : ''}
            </h1>
            <p className="text-sm text-muted-foreground font-mono text-center">
              Glad to see you again. Head over to the chat to continue your conversations.
            </p>
          </div>
          <Button
            onClick={() => router.navigate({ to: '/chat' })}
            className="w-full max-w-xs rounded-xl bg-foreground text-background hover:bg-foreground/90 font-mono text-sm py-3 transition-all duration-300"
          >
            Go to Chat
          </Button>

          <div className="w-full max-w-xs border-t border-border pt-6 mt-4 flex flex-col items-center gap-4">
            <p className="text-sm text-muted-foreground font-mono text-center">
              Not in the mood? The back button is right there.
            </p>
            <Button
              variant="outline"
              onClick={() => signOut()}
              className="w-full rounded-xl border-border bg-card hover:bg-muted hover:border-muted-foreground/30 text-muted-foreground hover:text-foreground font-mono text-sm py-3 transition-all duration-300"
            >
              Sign Out
            </Button>
            <p className="text-xs text-muted-foreground/30 font-mono text-center">
              Leaving so soon? The void will miss you.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center relative overflow-hidden px-4">
      <div className="relative z-10 flex flex-col items-center gap-8 max-w-lg w-full">
        {/* Logo / Brand */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-card border border-border flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-foreground">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <h1 className="text-3xl font-semibold text-center font-mono tracking-tight">
            Something Great
          </h1>
        </div>

        <p className="text-center text-muted-foreground font-mono text-sm leading-relaxed max-w-sm">
          A safe and secure place for meaningful conversations and sharing images at original quality.
        </p>

        {/* CTA */}
        <div className="w-full flex flex-col items-center gap-3 pt-2">
          <Link to="/signup" className="w-full max-w-xs">
            <Button className="w-full rounded-xl bg-foreground text-background hover:bg-foreground/90 font-mono text-sm py-3 transition-all duration-300">
              Sign Up to Get Started
            </Button>
          </Link>

          <div className="flex items-center gap-3 w-full max-w-xs py-2">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground/50 font-mono">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <p className="text-center text-sm text-muted-foreground font-mono">
            Already a member?
          </p>
          <Link to="/signin" className="w-full max-w-xs">
            <Button variant="outline" className="w-full rounded-xl border-border bg-card hover:bg-muted hover:border-muted-foreground/30 text-foreground font-mono text-sm py-3 transition-all duration-300">
              Sign In
            </Button>
          </Link>
        </div>

        {/* Footer */}
        <p className="text-xs text-muted-foreground/40 font-mono pt-4">
          © {new Date().getFullYear()} Something Great
        </p>
      </div>
    </div>
  )
}