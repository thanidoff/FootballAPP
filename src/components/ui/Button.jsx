const VARIANTS = {
  primary:   'bg-[#FD5461] text-white hover:bg-[#e03d4a] active:bg-[#c0333e]',
  secondary: 'bg-[#0A1318] text-white hover:bg-[#1a2830] active:bg-black',
  light:     'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300',
  outline:   'bg-white border border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50 active:bg-gray-100',
  danger:    'bg-red-600 text-white hover:bg-red-500 active:bg-red-700',
  ghost:     'text-gray-600 hover:text-gray-900 hover:bg-gray-100 active:bg-gray-200',
}

const SIZES = {
  sm: 'min-h-9 px-3 py-1.5 type-label',
  md: 'min-h-10 px-4 py-2 type-body',
  lg: 'min-h-11 px-6 py-2.5 type-body-lg',
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled,
  ...props
}) {
  return (
    <button
      className={`
        inline-flex items-center justify-center gap-2 rounded-xl font-medium
        ui-transition-fast cursor-pointer transition-[background-color,border-color,color,box-shadow,transform]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD5461]/35 focus-visible:ring-offset-2
        active:scale-[0.96]
        disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none
        ${VARIANTS[variant]} ${SIZES[size]} ${className}
      `}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
