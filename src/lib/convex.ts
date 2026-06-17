import { ConvexReactClient } from 'convex/react';

const convexUrl = 
  import.meta.env.VITE_CONVEX_URL || 
  (typeof process !== 'undefined' ? process.env.VITE_CONVEX_URL : undefined);

if (!convexUrl) {
  throw new Error('VITE_CONVEX_URL environment variable is not set');
}

export const convex = new ConvexReactClient(convexUrl);