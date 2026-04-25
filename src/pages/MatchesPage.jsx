import { useNavigate } from 'react-router-dom'
import PageWrapper from '../components/ui/PageWrapper'

function IconBall() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2"/>
      <path d="M16 2c0 0 3 5 0 14s0 14 0 14M2 16h28M6 7c0 0 5 3 10 3s10-3 10-3M6 25c0 0 5-3 10-3s10 3 10 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}
function IconTrophy() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <path d="M10 4h12v10a6 6 0 01-12 0V4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M10 8H6a4 4 0 004 4M22 8h4a4 4 0 01-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M16 20v4M10 28h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}
function IconCalendar() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <rect x="4" y="6" width="24" height="22" rx="3" stroke="currentColor" strokeWidth="2"/>
      <path d="M4 13h24M11 4v4M21 4v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <rect x="9" y="18" width="4" height="4" rx="1" fill="currentColor"/>
      <rect x="19" y="18" width="4" height="4" rx="1" fill="currentColor"/>
    </svg>
  )
}

export default function MatchesPage() {
  const navigate = useNavigate()

  const MODES = [
    {
      key: 'friendly',
      icon: <IconBall />,
      title: 'Friendly',
      sub: 'กระชับมิตร',
      desc: 'จัดแมตช์ระหว่างสองทีม ไม่มีผลต่อตาราง',
      enabled: true,
      onClick: () => navigate('/matches/friendly'),
    },
    {
      key: 'tournament',
      icon: <IconTrophy />,
      title: 'World Cup',
      sub: 'ทีมชาติ · แพ้คัดออก',
      desc: 'เลือก 16 ทีมชาติ สุ่มคู่แข่งจนได้แชมป์',
      enabled: true,
      onClick: () => navigate('/matches/world-cup'),
    },
    {
      key: 'club-cup',
      icon: <IconCalendar />,
      title: 'Club Cup',
      sub: 'สโมสร · แพ้คัดออก',
      desc: 'เลือก 16 สโมสร สุ่มคู่แข่งจนได้แชมป์',
      enabled: true,
      onClick: () => navigate('/matches/club-cup'),
    },
    {
      key: 'league',
      icon: <IconTrophy />,
      title: 'League',
      sub: 'สโมสร · เก็บคะแนน',
      desc: 'เลือก 6 สโมสร แข่งแบบลีก 10 สัปดาห์ + นัดชิง All Stars',
      enabled: true,
      onClick: () => navigate('/matches/league'),
    },
  ]

  return (
    <PageWrapper>
      <div className="mb-8">
        <h1 className="font-heading font-black text-3xl uppercase tracking-wide">Matches</h1>
        <p className="text-gray-500 text-sm mt-0.5">Choose a match format to get started</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {MODES.map(mode => (
          <button
            key={mode.key}
            onClick={mode.enabled ? mode.onClick : undefined}
            disabled={!mode.enabled}
            className={`relative text-left p-6 rounded-2xl border-2 transition-all duration-150 group
              ${mode.enabled
                ? 'border-gray-100 bg-white hover:border-[#FD5461] hover:shadow-lg cursor-pointer'
                : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
              }`}
          >
            {!mode.enabled && (
              <span className="absolute top-4 right-4 text-[10px] font-heading font-black uppercase tracking-widest text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                Soon
              </span>
            )}
            <div className={`mb-4 transition-colors ${mode.enabled ? 'text-[#0A1318] group-hover:text-[#FD5461]' : 'text-gray-400'}`}>
              {mode.icon}
            </div>
            <div className="font-heading font-black text-xl uppercase tracking-wide text-[#0A1318]">{mode.title}</div>
            <div className="text-xs font-heading font-bold text-[#FD5461] uppercase tracking-wider mt-0.5">{mode.sub}</div>
            <div className="text-sm text-gray-400 mt-2 leading-relaxed">{mode.desc}</div>
          </button>
        ))}
      </div>
    </PageWrapper>
  )
}

