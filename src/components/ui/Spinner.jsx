export default function Spinner({ size = 24, color = '#0A1318' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ animation: 'spin 0.75s linear infinite' }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2.5" strokeOpacity="0.15" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}
