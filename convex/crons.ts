import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Run cleanup of old messages and images every hour
crons.interval(
  'cleanup old messages and images',
  { hours: 1 },
  internal.cleanup.runCleanup,
  {},
)

export default crons
