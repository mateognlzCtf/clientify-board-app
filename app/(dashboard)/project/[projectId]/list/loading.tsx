export default function ListLoading() {
  return (
    <div className="p-6">
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="h-9 w-56 bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-9 w-24 bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-9 w-24 bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-9 w-32 bg-gray-200 rounded-lg animate-pulse ml-auto" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-100 bg-gray-50 px-4 py-2.5">
          <div className="flex gap-8">
            {['w-16', 'w-48', 'w-24', 'w-16', 'w-16', 'w-24', 'w-24'].map((w, i) => (
              <div key={i} className={`h-3 ${w} bg-gray-200 rounded animate-pulse`} />
            ))}
          </div>
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-8 px-4 py-3 border-b border-gray-50 last:border-0">
            <div className="h-3 w-16 bg-gray-100 rounded animate-pulse" />
            <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
            <div className="h-5 w-24 bg-gray-100 rounded animate-pulse" />
            <div className="h-3 w-16 bg-gray-100 rounded animate-pulse" />
            <div className="h-3 w-16 bg-gray-100 rounded animate-pulse" />
            <div className="h-5 w-20 bg-gray-100 rounded-full animate-pulse" />
            <div className="h-5 w-20 bg-gray-100 rounded-full animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}
