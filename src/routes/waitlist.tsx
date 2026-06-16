import { createFileRoute } from '@tanstack/react-router'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'

export const Route = createFileRoute('/waitlist')({
  component: RouteComponent,
})

function RouteComponent() {
return (
   <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center">
        <div className="p-8">
          <h1 className="text-4xl font-bold text-center font-mono">Please fill the form for the Waitlist</h1>
        </div>
        <div className="p-8 w-full flex justify-center">
            <form className="flex flex-col gap-4 w-full max-w-md font-mono">
                <Input type="text" placeholder="Name" className="w-full" />
                <Input type="email" placeholder="Email" className="w-full" />
                <Button type="submit" className="rounded bg-card px-4 py-2 font-mono text-white transition-transform duration-1000 ease-in-out hover:bg-muted hover:text-foreground ">
                    Join Waitlist
                </Button>
            </form>
        </div>
    </div>  
  )
}
