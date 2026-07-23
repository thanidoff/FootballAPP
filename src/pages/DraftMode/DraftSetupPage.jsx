import { Navigate, useSearchParams } from 'react-router-dom'

export default function DraftSetupPage() {
  const [searchParams] = useSearchParams()
  const name = searchParams.get('name') || ''
  return <Navigate to={`/draft${name ? `?name=${encodeURIComponent(name)}` : ''}`} replace />
}
