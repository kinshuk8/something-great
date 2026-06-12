import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <>
      <div className="p-8">
        <h1 className="text-4xl font-bold text-center">Welcome to Something Great</h1>
      </div>
      <div className="p-8">
        <p className="text-lg text-center">This is the home page of our amazing application. Explore and enjoy!</p>
      </div>
    </>
  )
}
