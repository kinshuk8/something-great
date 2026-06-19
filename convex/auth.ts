import { convexAuth } from '@convex-dev/auth/server'
import { Password } from '@convex-dev/auth/providers/Password'

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        return {
          email: params.email as string,
          displayName:
            (params.displayName as string) ||
            (params.email as string).split('@')[0],
          username:
            (params.username as string) ||
            (params.email as string).split('@')[0],
          avatarSeed: crypto.randomUUID(),
        }
      },
    }),
  ],
  session: {
    totalDurationMs: 2 * 60 * 60 * 1000, // 2-hour maximum session time
    inactiveDurationMs: 30 * 60 * 1000, // 30-minute inactivity limit
  },
})
