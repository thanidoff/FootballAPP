export default function AllStarIcon({ size = 24, badgeUrl = null, className = '' }) {
  const imageSrc = badgeUrl || '/badges/allstar.png'
  return (
    <img
      src={imageSrc}
      alt="All-Stars"
      style={{ width: size, height: size }}
      className={`object-contain ${className}`}
    />
  )
}
