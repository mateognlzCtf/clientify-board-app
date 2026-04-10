export default function GlobalLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="flex items-center gap-2 text-gray-400">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600" />
        <span className="text-sm">Cargando...</span>
      </div>
    </div>
  )
}
