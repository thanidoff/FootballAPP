export function SkeletonCard() {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-16 h-16 rounded-full bg-gray-200 flex-shrink-0" />
        <div className="flex-1 pt-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded-full w-3/4" />
          <div className="h-3 bg-gray-100 rounded-full w-1/2" />
        </div>
        <div className="w-11 h-11 rounded-xl bg-gray-200 flex-shrink-0" />
      </div>
      <div className="border-t border-gray-100 my-4" />
      <div className="space-y-2.5">
        {[80, 65, 90, 55, 70, 75].map((w, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-2.5 bg-gray-100 rounded-full w-8" />
            <div className="h-2.5 bg-gray-100 rounded-full w-8" />
            <div className="h-1.5 bg-gray-200 rounded-full flex-1" style={{ maxWidth: `${w}%` }} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function SkeletonRow() {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 flex items-center gap-3 animate-pulse">
      <div className="w-8 h-5 bg-gray-200 rounded-md flex-shrink-0" />
      <div className="w-12 h-12 rounded-2xl bg-gray-200 flex-shrink-0" />
      <div className="w-11 h-11 rounded-full bg-gray-200 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-gray-200 rounded-full w-2/5" />
        <div className="h-2.5 bg-gray-100 rounded-full w-1/4" />
      </div>
      <div className="h-3 bg-gray-100 rounded-full w-16 hidden sm:block" />
      <div className="flex gap-2">
        <div className="h-7 w-10 bg-gray-100 rounded-lg" />
        <div className="h-7 w-10 bg-gray-100 rounded-lg" />
      </div>
    </div>
  )
}

export function SkeletonClubCard() {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 animate-pulse flex items-center gap-4">
      <div className="w-14 h-14 rounded-xl bg-gray-200 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-200 rounded-full w-1/2" />
        <div className="h-3 bg-gray-100 rounded-full w-1/3" />
      </div>
      <div className="w-10 h-5 bg-gray-200 rounded-full" />
    </div>
  )
}
