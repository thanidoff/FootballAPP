import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/ui/Layout'

const PlayersPage = lazy(() => import('./pages/PlayersPage'))
const CoachesPage = lazy(() => import('./pages/CoachesPage'))
const ClubsPage = lazy(() => import('./pages/ClubsPage'))
const ClubRosterPage = lazy(() => import('./pages/ClubRosterPage'))
const MatchesPage = lazy(() => import('./pages/MatchesPage'))
const FriendlyMatchesPage = lazy(() => import('./pages/FriendlyMatchesPage'))
const PreMatchPage = lazy(() => import('./pages/PreMatchPage'))
const WorldCupPage = lazy(() => import('./pages/WorldCupPage'))
const LeaguePage = lazy(() => import('./pages/LeaguePage'))
const DraftSavesPage = lazy(() => import('./pages/DraftMode/DraftSavesPage'))
const DraftSetupPage = lazy(() => import('./pages/DraftMode/DraftSetupPage'))
const DraftRollPage = lazy(() => import('./pages/DraftMode/DraftRollPage'))
const DraftDashboardPage = lazy(() => import('./pages/DraftMode/DraftDashboardPage'))
const DraftOverviewTab = lazy(() => import('./pages/DraftMode/Tabs/DraftOverviewTab'))
const DraftSquadsTab = lazy(() => import('./pages/DraftMode/Tabs/DraftSquadsTab'))
const DraftTransfersTab = lazy(() => import('./pages/DraftMode/Tabs/DraftTransfersTab'))
const DraftMatchesTab = lazy(() => import('./pages/DraftMode/Tabs/DraftMatchesTab'))
const DraftCupTab = lazy(() => import('./pages/DraftMode/Tabs/DraftCupTab'))
const DraftNationalCupTab = lazy(() => import('./pages/DraftMode/Tabs/DraftNationalCupTab'))

function PageFallback() {
  return <div role="status" aria-live="polite" className="mx-auto mt-20 h-1 w-28 overflow-hidden rounded-full bg-gray-100"><span className="block h-full w-1/2 animate-pulse rounded-full bg-[#FD5461]" /></div>
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageFallback />}>
      <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/players" replace />} />
            <Route path="players" element={<PlayersPage />} />
            <Route path="coaches" element={<CoachesPage />} />
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
              <Route path="coach-transfers" element={<DraftTransfersTab />} />
              <Route path="matches" element={<DraftMatchesTab />} />
              <Route path="cup" element={<DraftCupTab />} />
              <Route path="national-cup" element={<DraftNationalCupTab />} />
            </Route>
          </Route>
      </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
