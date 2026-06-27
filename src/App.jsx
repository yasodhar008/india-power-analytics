import { useState } from 'react'
import Dashboard    from './components/Dashboard'
import History      from './components/History'
import Upload       from './components/Upload'
import Regional     from './components/Regional'
import Snapshots    from './components/Snapshots'
import Status       from './components/Status'
import Intelligence from './components/Intelligence'
import Sources      from './components/Sources'
import AuthPage     from './components/AuthPage'
import Projects     from './components/Projects'
import TenderIntelligence from './components/TenderIntelligence'
import BessAnalytica from './components/BessAnalytica'
import AdminPanel from './components/AdminPanel'
import { useAuth }  from './lib/AuthContext'
import './index.css'

const PUBLIC_TABS = [
  { id: 'dashboard',    label: 'Dashboard' },
  { id: 'snapshots',    label: 'Snapshots' },
  { id: 'history',      label: 'Trends' },
  { id: 'regional',     label: 'Regional' },
  { id: 'intelligence', label: '🔋 Intelligence' },
  { id: 'tenders',      label: 'Tenders' },
  { id: 'bess',         label: 'BESS Analytica' },
  { id: 'projects',     label: 'Projects' },
]

const ADMIN_TABS = [
  { id: 'upload',       label: 'Upload' },
  { id: 'sources',      label: 'Sources' },
  { id: 'status',       label: 'Status ◉' },
  { id: 'admin',        label: 'Admin Panel 🔒' },
]

export default function App() {
  const { user, profile, isAdmin, loading, signOut } = useAuth()
  const [tab, setTab] = useState('dashboard')
  const [selectedDate, setSelectedDate] = useState(null)

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>
  }

  if (!user) {
    return <AuthPage />
  }

  const TABS = isAdmin ? [...PUBLIC_TABS, ...ADMIN_TABS] : PUBLIC_TABS

  return (
    <div className="app bg-gray-50 min-h-screen">
      <header className="header">
        <div className="header-inner">
          <div className="brand">
            <span className="brand-mark">⚡</span>
            <div>
              <div className="brand-name">VTKenergy.com</div>
            </div>
          </div>
          <nav className="nav">
            {TABS.map(t => (
              <button key={t.id}
                className={`nav-btn ${tab === t.id ? 'active' : ''}`}
                onClick={() => setTab(t.id)}
              >{t.label}</button>
            ))}
            <button
              className="nav-btn text-red-500 hover:text-red-700 ml-4"
              onClick={signOut}
            >
              Sign Out
            </button>
          </nav>
        </div>
      </header>

      <main className="main">
        {tab === 'dashboard'    && <Dashboard selectedDate={selectedDate} onDateChange={setSelectedDate} />}
        {tab === 'snapshots'    && <Snapshots />}
        {tab === 'history'      && <History />}
        {tab === 'regional'     && <Regional />}
        {tab === 'intelligence' && <Intelligence />}
        {tab === 'tenders'      && <TenderIntelligence onAnalyseTender={() => {}} />}
        {tab === 'bess'         && <BessAnalytica />}
        {tab === 'admin'        && <AdminPanel />}
        {tab === 'projects'     && <Projects />}
        {tab === 'upload'       && <Upload onUploaded={() => setTab('dashboard')} />}
        {tab === 'sources'      && <Sources />}
        {tab === 'status'       && <Status />}
      </main>

      <footer className="footer">
        <span>Sources: CEA OPM · CEA RPMD · NPP · ICED (NITI Aayog)</span>
        <span>Snapshots: 08:00 · 13:00 · 18:00 IST · Supabase ap-south-1</span>
      </footer>
    </div>
  )
}
