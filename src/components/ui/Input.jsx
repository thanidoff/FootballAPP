export default function Input({ label, error, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-heading font-bold tracking-wider uppercase text-gray-500">
          {label}
        </label>
      )}
      <input
        className={`
          w-full px-3 py-2 rounded-lg border bg-white text-gray-900 text-sm
          border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-400
          placeholder:text-gray-400 transition-colors
          ${error ? 'border-red-400 focus:ring-red-400/20' : ''}
          ${className}
        `}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
