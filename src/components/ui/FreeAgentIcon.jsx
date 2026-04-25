export default function FreeAgentIcon({ size = 24, light = false }) {
  const id = light ? 'fa-shield-light' : 'fa-shield'
  const from = light ? '#9ca3af' : '#6b7280'
  const to = light ? '#6b7280' : '#374151'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
      <path
        d="M12 2L3 6v5.5C3 16.75 7 21 12 22c5-1 9-5.25 9-10.5V6L12 2z"
        fill={`url(#${id})`}
      />
      <circle cx="12" cy="9" r="2" fill="white" fillOpacity="0.85" />
      <path
        d="M7.5 17.5c0-2.485 2.015-4.5 4.5-4.5s4.5 2.015 4.5 4.5"
        stroke="white"
        strokeOpacity="0.85"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}
