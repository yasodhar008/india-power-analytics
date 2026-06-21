import { useState } from 'react'
import { parseGenerationCSV, parseDemandCSV, deriveSummary } from '../lib/parseCSV'
import {
  uploadGenerationData, uploadDemandData,
  upsertDailySummary
} from '../lib/supabase'

function DropZone({ label, desc, onFile, file, status }) {
  const handleChange = e => { if (e.target.files[0]) onFile(e.target.files[0]) }
  const handleDrop = e => {
    e.preventDefault()
    if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0])
  }
  return (
    <div
      className={`drop-zone ${file ? 'has-file' : ''} ${status === 'ok' ? 'status-ok' : ''}`}
      onDragOver={e => e.preventDefault()}
      onDrop={handleDrop}
      onClick={() => document.getElementById(`file-${label}`).click()}
    >
      <input id={`file-${label}`} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleChange} />
      <div className="dz-icon">{status === 'ok' ? '✓' : file ? '📄' : '↑'}</div>
      <div className="dz-label">{label}</div>
      <div className="dz-desc">{file ? file.name : desc}</div>
      {status === 'ok' && <div className="dz-ok">Uploaded to Supabase</div>}
    </div>
  )
}

export default function Upload({ onUploaded }) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [genFile, setGenFile] = useState(null)
  const [demFile, setDemFile] = useState(null)
  const [status, setStatus] = useState({})
  const [log, setLog] = useState([])
  const [uploading, setUploading] = useState(false)

  const addLog = (msg, type = 'info') => setLog(l => [...l, { msg, type, time: new Date().toLocaleTimeString() }])

  const handleUpload = async () => {
    if (!genFile && !demFile) { addLog('Add at least one file first.', 'warn'); return }
    setUploading(true)
    setLog([])

    let genRows = null, demRows = null

    try {
      if (genFile) {
        addLog(`Parsing ${genFile.name}...`)
        const text = await genFile.text()
        genRows = parseGenerationCSV(text)
        addLog(`Parsed ${genRows.length} generation records`, 'ok')
        await uploadGenerationData(date, genRows)
        setStatus(s => ({ ...s, gen: 'ok' }))
        addLog('Generation data saved to Supabase ✓', 'ok')
      }

      if (demFile) {
        addLog(`Parsing ${demFile.name}...`)
        const text = await demFile.text()
        demRows = parseDemandCSV(text)
        addLog(`Parsed ${demRows.length} demand records`, 'ok')
        await uploadDemandData(date, demRows)
        setStatus(s => ({ ...s, dem: 'ok' }))
        addLog('Demand data saved to Supabase ✓', 'ok')
      }

      // Build and save daily summary
      if (genRows || demRows) {
        const summary = deriveSummary(date, genRows || [], demRows || [])
        await upsertDailySummary(summary)
        addLog(`Daily summary saved for ${date} ✓`, 'ok')
      }

      addLog('All done! Redirecting to dashboard...', 'ok')
      setTimeout(onUploaded, 1200)
    } catch (err) {
      addLog(`Error: ${err.message}`, 'err')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="dashboard">
      <div className="page-head">
        <div>
          <h2 className="page-title">Upload data</h2>
          <p className="page-sub">Add a new day's generation and demand files</p>
        </div>
      </div>

      <div className="upload-date-row">
        <label className="field-label">Data date</label>
        <input type="date" className="date-select" value={date} onChange={e => setDate(e.target.value)} />
        <span className="field-hint">Match this to the date in your downloaded CSVs</span>
      </div>

      <div className="drop-grid">
        <DropZone
          label="Generation mix CSV"
          desc="All_India_Generation_YYYY-MM-DD.csv — from vidyut.gov.in"
          onFile={setGenFile} file={genFile} status={status.gen}
        />
        <DropZone
          label="Demand met CSV"
          desc="Demand_Met_Data_YYYY-MM-DD.csv — from vidyut.gov.in"
          onFile={setDemFile} file={demFile} status={status.dem}
        />
      </div>

      <button
        className={`upload-btn ${uploading ? 'loading' : ''}`}
        onClick={handleUpload}
        disabled={uploading}
      >
        {uploading ? 'Uploading...' : 'Upload to Supabase →'}
      </button>

      {log.length > 0 && (
        <div className="log-panel">
          {log.map((l, i) => (
            <div key={i} className={`log-line ${l.type}`}>
              <span className="log-time">{l.time}</span>
              <span>{l.msg}</span>
            </div>
          ))}
        </div>
      )}

      <div className="upload-info-box">
        <div className="info-title">Where to download these files</div>
        <div className="info-row">
          <span className="info-label">Generation + demand</span>
          <a href="https://vidyut.gov.in" target="_blank" rel="noreferrer" className="info-link">vidyut.gov.in →</a>
        </div>
        <div className="info-row">
          <span className="info-label">NPP daily reports</span>
          <a href="https://npp.gov.in/publishedReports" target="_blank" rel="noreferrer" className="info-link">npp.gov.in/publishedReports →</a>
        </div>
        <div className="info-row">
          <span className="info-label">CEA RE report</span>
          <a href="https://cea.nic.in/renewable-generation-report/?lang=en" target="_blank" rel="noreferrer" className="info-link">cea.nic.in →</a>
        </div>
      </div>
    </div>
  )
}
