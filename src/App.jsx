import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/ui/Layout'
import PlayersPage from './pages/PlayersPage'
import ClubsPage from './pages/ClubsPage'
import ClubRosterPage from './pages/ClubRosterPage'
import MatchesPage from './pages/MatchesPage'
import FriendlyMatchesPage from './pages/FriendlyMatchesPage'
import PreMatchPage from './pages/PreMatchPage'
import WorldCupPage from './pages/WorldCupPage'
import LeaguePage from './pages/LeaguePage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/players" replace />} />
          <Route path="players" element={<PlayersPage />} />
          <Route path="clubs" element={<ClubsPage />} />
          <Route path="clubs/:id" element={<ClubRosterPage />} />
          <Route path="matches" element={<MatchesPage />} />
          <Route path="matches/friendly" element={<FriendlyMatchesPage />} />
          <Route path="matches/friendly/:matchId/prematch" element={<PreMatchPage />} />
          <Route path="matches/world-cup" element={<WorldCupPage mode="national" />} />
          <Route path="matches/world-cup/:matchId/prematch" element={<PreMatchPage />} />
          <Route path="matches/club-cup" element={<WorldCupPage mode="club" />} />
          <Route path="matches/club-cup/:matchId/prematch" element={<PreMatchPage />} />
          <Route path="matches/league" element={<LeaguePage />} />
          <Route path="matches/league/:matchId/prematch" element={<PreMatchPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
