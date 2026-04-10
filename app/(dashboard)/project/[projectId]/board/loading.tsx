export default function BoardLoading() {
  return (
    <div className="flex gap-3 p-6 overflow-x-auto">
      {Array.from({ length: 5 }).map((_, col) => (
        <div key={col} className="flex flex-col w-64 shrink-0">
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="h-5 w-20 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-4 bg-gray-100 rounded animate-pulse" />
          </div>
          <div className="flex flex-col gap-2 bg-gray-50 rounded-xl p-2 min-h-[200px]">
            {Array.from({ length: col === 0 ? 3 : col === 1 ? 2 : 1 }).map((_, card) => (
              <div key={card} className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
                <div className="flex justify-between">
                  <div className="h-3 w-12 bg-gray-100 rounded animate-pulse" />
                  <div className="h-3 w-3 bg-gray-100 rounded animate-pulse" />
                </div>
                <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-2/3 bg-gray-200 rounded animate-pulse" />
                <div className="flex justify-between">
                  <div className="h-3 w-8 bg-gray-100 rounded animate-pulse" />
                  <div className="h-5 w-5 rounded-full bg-gray-100 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
