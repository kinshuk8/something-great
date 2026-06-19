import { Input } from '#/components/ui/input'
import { Button } from '#/components/ui/button'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { useAuthActions, useConvexAuth } from '@convex-dev/auth/react'

export const Route = createFileRoute('/signin')({
  component: RouteComponent,
})

function RouteComponent() {
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { signIn } = useAuthActions()

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="font-mono text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (isAuthenticated) {
    router.navigate({ to: '/chat' })
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      await signIn('password', {
        flow: 'signIn',
        email,
        password,
      })
      router.navigate({ to: '/chat' })
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Sign in failed. Please try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center relative overflow-hidden px-4">
      <div className="relative z-10 flex flex-col items-center gap-6 w-full max-w-sm">
        {/* Header */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-xl bg-card border border-border flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted-foreground"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold font-mono tracking-tight">
            Welcome back
          </h1>
        </div>

        <p className="text-sm text-muted-foreground font-mono text-center -mt-2">
          Sign in to continue
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-mono ml-1">
              Email
            </label>
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl bg-card border-border px-4 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring focus:border-border transition-all duration-200"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-mono ml-1">
              Password
            </label>
            <Input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-xl bg-card border-border px-4 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring focus:border-border transition-all duration-200"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-muted border border-border px-4 py-2.5">
              <p className="text-foreground text-sm font-mono text-center">
                {error}
              </p>
            </div>
          )}

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-foreground text-background hover:bg-foreground/90 font-mono text-sm py-2.5 transition-all duration-300 disabled:opacity-40"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Signing In...
              </span>
            ) : (
              'Come on in, the door is open!'
            )}
          </Button>
        </form>

        {/* Footer */}
        <div className="flex items-center gap-1.5 pt-1">
          <span className="text-sm text-muted-foreground font-mono">
            Don't have an account?
          </span>
          <Link to="/signup">
            <Button
              variant="link"
              className="text-foreground hover:text-muted-foreground font-mono text-sm transition-colors p-0 h-auto"
            >
              Sign Up
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
