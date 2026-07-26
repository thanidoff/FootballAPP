export default function AllStarIcon({ size = 24, badgeUrl = null, className = '' }) {
  if (badgeUrl) {
    return (
      <img
        src={badgeUrl}
        alt="All-Stars"
        style={{ width: size, height: size }}
        className={`object-contain ${className}`}
      />
    )
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="allstar-badge-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FD5461" />
          <stop offset="100%" stopColor="#D02E3C" />
        </linearGradient>
      </defs>
      {/* Shield shape */}
      <path
        d="M12 2L3 6v5.5C3 16.75 7 21 12 22c5-1 9-5.25 9-10.5V6L12 2z"
        fill="url(#allstar-badge-grad)"
      />
      {/* Golden Star in center */}
      <path
        d="M12 6.5l1.6 3.24 3.58.52-2.59 2.52.61 3.56L12 14.66l-3.2 1.68.61-3.56-2.59-2.52 3.58-.52L12 6.5z"
        fill="#FFD700"
      />
    </svg>
  )
}
