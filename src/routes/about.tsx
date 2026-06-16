import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({ component: About })

function About() {
  return (
    <>
      <div className="p-8">
        <h1 className="text-4xl font-bold text-center">About Us</h1>
      </div>
      <div className="p-8">
        <p className="text-lg text-center">Learn more about our company and what we do.</p>
      </div>
    </>
  )
}
