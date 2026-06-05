import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AuthWrapper from './components/ui/AuthWrapper'
import Layout from './components/ui/Layout'
import PlayersPage from './pages/PlayersPage'
import ClubsPage from './pages/ClubsPage'
import ClubRosterPage from './pages/ClubRosterPage'
import MatchesPage from './pages/MatchesPage'
import FriendlyMatchesPage from './pages/FriendlyMatchesPage'
import PreMatchPage from './pages/PreMatchPage'
import WorldCupPage from './pages/WorldCupPage'
import LeaguePage from './pages/LeaguePage'
import DraftSavesPage from './pages/DraftMode/DraftSavesPage'
import DraftSetupPage from './pages/DraftMode/DraftSetupPage'
import DraftRollPage from './pages/DraftMode/DraftRollPage'
import DraftDashboardPage from './pages/DraftMode/DraftDashboardPage'
import DraftOverviewTab from './pages/DraftMode/Tabs/DraftOverviewTab'
import DraftSquadsTab from './pages/DraftMode/Tabs/DraftSquadsTab'
import DraftTransfersTab from './pages/DraftMode/Tabs/DraftTransfersTab'
import DraftMatchesTab from './pages/DraftMode/Tabs/DraftMatchesTab'

export default function App() {
  return (
    <BrowserRouter>
      <AuthWrapper>
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
            <Route path="matches/draft/prematch" element={<PreMatchPage />} />
            <Route path="draft" element={<DraftSavesPage />} />
            <Route path="draft/setup" element={<DraftSetupPage />} />
            <Route path="draft/roll" element={<DraftRollPage />} />
            <Route path="draft/:saveId" element={<DraftDashboardPage />}>
              <Route index element={<Navigate to="overview" replace />} />
              <Route path="overview" element={<DraftOverviewTab />} />
              <Route path="squads" element={<DraftSquadsTab />} />
              <Route path="transfers" element={<DraftTransfersTab />} />
              <Route path="matches" element={<DraftMatchesTab />} />
            </Route>
          </Route>
        </Routes>
      </AuthWrapper>
    </BrowserRouter>
  )
}
