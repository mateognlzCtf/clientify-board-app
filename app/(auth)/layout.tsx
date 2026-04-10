import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Acceso',
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Branding */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <span className="text-white text-sm font-bold">C</span>
            </div>
            <span className="text-xl font-bold text-gray-900">
              Clientify Board
            </span>
          </div>
          <p className="text-sm text-gray-500">Gestión de proyectos</p>
        </div>

        {children}
      </div>
    </div>
  )
}
