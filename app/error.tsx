'use client'

import { useEffect } from 'react'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('[Error global]:', error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center max-w-md px-4">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Algo salió mal
        </h1>
        <p className="text-gray-500 mb-6">
          Ocurrió un error inesperado. Puedes intentar de nuevo o volver al
          inicio.
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Intentar de nuevo
        </button>
      </div>
    </div>
  )
}
