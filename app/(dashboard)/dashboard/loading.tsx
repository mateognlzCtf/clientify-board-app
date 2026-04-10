export default function DashboardLoading() {
  return (
    <div className="p-6">
      {/* Toolbar skeleton */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-9 w-64 bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-9 w-36 bg-gray-200 rounded-lg animate-pulse ml-auto" />
      </div>

      {/* Cards grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <div className="h-5 w-3/4 bg-gray-200 rounded animate-pulse" />
            <div className="h-3 w-1/3 bg-gray-100 rounded animate-pulse" />
            <div className="h-4 w-full bg-gray-100 rounded animate-pulse" />
            <div className="h-4 w-2/3 bg-gray-100 rounded animate-pulse" />
            <div className="flex justify-between items-center pt-2 border-t border-gray-50">
              <div className="flex gap-1">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="h-6 w-6 rounded-full bg-gray-200 animate-pulse" />
                ))}
              </div>
              <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
