import { Input } from '#/components/ui/input'
import { Button } from '#/components/ui/button'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useAuthActions, useConvexAuth } from '@convex-dev/auth/react'

export const Route = createFileRoute('/signup')({
  component: RouteComponent,
})

function RouteComponent() {
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
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

  useEffect(() => {
    if (isAuthenticated) {
      router.navigate({ to: '/chat' })
    }
  }, [isAuthenticated, router])

  if (isAuthenticated) {
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setIsSubmitting(true)

    try {
      const normalizedEmail = email.toLowerCase().trim()
      await signIn('password', {
        flow: 'signUp',
        email: normalizedEmail,
        password,
        displayName: displayName || normalizedEmail.split('@')[0],
        username: normalizedEmail.split('@')[0],
      })
      router.navigate({ to: '/chat' })
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Sign up failed. Please try again.',
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
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="22" y1="11" x2="16" y2="11" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold font-mono tracking-tight">
            Create your account
          </h1>
        </div>

        <p className="text-sm text-muted-foreground font-mono text-center -mt-2">
          Join Something Great and start connecting
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-mono ml-1">
              Display Name
            </label>
            <Input
              type="text"
              placeholder="How others see you"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-xl bg-card border-border px-4 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring focus:border-border transition-all duration-200"
            />
          </div>
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
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-xl bg-card border-border px-4 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring focus:border-border transition-all duration-200"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-mono ml-1">
              Confirm Password
            </label>
            <Input
              type="password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
                Creating Account...
              </span>
            ) : (
              'Create Account'
            )}
          </Button>
        </form>

        {/* Footer */}
        <div className="flex items-center gap-1.5 pt-1">
          <span className="text-sm text-muted-foreground font-mono">
            Already have an account?
          </span>
          <Link to="/signin">
            <Button
              variant="link"
              className="text-foreground hover:text-muted-foreground font-mono text-sm transition-colors p-0 h-auto"
            >
              Sign In
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
