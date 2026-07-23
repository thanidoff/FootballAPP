export default function Input({ label, error, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="type-label text-gray-600">
          {label}
        </label>
      )}
      <input
        className={`
          min-h-11 w-full rounded-xl border bg-white px-3 py-2 text-gray-900 type-body
          border-gray-200 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#FD5461]/15 focus:border-[#FD5461]
          placeholder:text-gray-400 ui-transition-fast transition-[border-color,box-shadow,background-color]
          disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400 disabled:opacity-100
          ${error ? 'border-red-400 focus:ring-red-400/20' : ''}
          ${className}
        `}
      {error && <p className="mt-1 animate-fadeIn type-body-sm text-red-500">{error}</p>}
    </div>
  )
}
