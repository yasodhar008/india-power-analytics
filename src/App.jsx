import { useState } from 'react'
import Dashboard    from './components/Dashboard'
import History      from './components/History'
import Upload       from './components/Upload'
import Regional     from './components/Regional'
import Snapshots    from './components/Snapshots'
import Status       from './components/Status'
import Intelligence from './components/Intelligence'
import Sources      from './components/Sources'
import './index.css'

const TABS = [
  { id: 'dashboard',    label: 'Dashboard' },
  { id: 'snapshots',    label: 'Snapshots' },
  { id: 'history',      label: 'Trends' },
  { id: 'regional',     label: 'Regional' },
  { id: 'intelligence', label: '🔋 Intelligence' },
  { id: 'upload',       label: 'Upload' },
  { id: 'sources',      label: 'Sources' },
  { id: 'status',       label: 'Status ◉' },
]

export default function App() {
  const [tab, setTab] = useState('dashboard')
  const [selectedDate, setSelectedDate] = useState(null)

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="brand">
            <span className="brand-mark">⚡</span>
            <div>
              <div className="brand-name">India Power Analytics</div>
              <div className="brand-sub">CEA · NPP · ICED · NITI Aayog</div>
            </div>
          </div>
          <nav className="nav">
            {TABS.map(t => (
              <button key={t.id}
                className={`nav-btn ${tab === t.id ? 'active' : ''}`}
                onClick={() => setTab(t.id)}
              >{t.label}</button>
            ))}
          </nav>
        </div>
      </header>

      <main className="main">
        {tab === 'dashboard'    && <Dashboard selectedDate={selectedDate} onDateChange={setSelectedDate} />}
        {tab === 'snapshots'    && <Snapshots />}
        {tab === 'history'      && <History />}
        {tab === 'regional'     && <Regional />}
        {tab === 'intelligence' && <Intelligence />}
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
