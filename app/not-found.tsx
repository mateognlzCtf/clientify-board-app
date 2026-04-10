import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <p className="text-5xl font-bold text-blue-600 mb-4">404</p>
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Página no encontrada
        </h1>
        <p className="text-gray-500 mb-8">
          La página que buscas no existe o fue movida.
        </p>
        <Link
          href="/dashboard"
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Ir al dashboard
        </Link>
      </div>
    </div>
  )
}
