import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/debug-env')({
  server: {
    handlers: {
      GET: async () => {
        const token = process.env.UPLOADTHING_TOKEN;
        if (!token) {
          return new Response(JSON.stringify({ status: "missing" }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        const hasQuotes = 
          token.startsWith("'") || 
          token.endsWith("'") || 
          token.startsWith('"') || 
          token.endsWith('"');
          
        let parsed = false;
        let parseError = null;
        try {
          // Attempt to strip potential surrounding quotes to see if that's the only issue
          const cleanToken = hasQuotes ? token.slice(1, -1) : token;
          const payload = JSON.parse(Buffer.from(cleanToken, 'base64').toString('utf8'));
          parsed = !!(payload.apiKey && payload.appId && payload.regions);
        } catch (e: any) {
          parseError = e.message;
        }
        
        return new Response(JSON.stringify({
          status: "present",
          hasQuotes,
          parsed,
          parseError,
          length: token.length,
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  }
})
