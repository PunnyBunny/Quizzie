import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="p-6 text-center">
      <h2 className="text-2xl font-semibold mb-2">404 - Not Found</h2>
      <p className="text-gray-600 mb-4">The page you are looking for does not exist.</p>
      <Link to="/" className="text-indigo-600 hover:underline">Go back home</Link>
    </div>
  )
}
