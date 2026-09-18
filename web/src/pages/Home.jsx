/* The command centre, fed by real runs: a quick check you can make from
   here, counts from the checks this browser has run, the live model
   status from /api/health, and the evidence graph of the latest run.
   Before the first run the graph shows a labelled sample instead. */
import { useState } from 'react'
import { check, labelClass, pct } from '../api.js'
import { Bar, Card, Metric, useToast } from '../ui.jsx'
import GraphBuilder from '../GraphBuilder.jsx'
import EvidenceGraph from './EvidenceGraph.jsx'

const LABELS = ['false', 'misleading', 'disputed', 'unverified', 'true']

export default function Home({ go, result, history, health, onResult, onClear }) {
  const toast = useToast()
  const [text, setText] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')

  async function quickCheck() {
    const value = text.trim()
    if (!value || running) return toast('Paste a message to check')

    setRunning(true)
    setError('')

    try {
      const data = await check('/check/text?graph=1', { text: value })
      onResult(data, 'text')
      toast('Analysis complete: ' + data.verdict.label)
    } catch (failure) {
      setError(failure.message)
    } finally {
      setRunning(false)
    }
  }

  const runs = history.length
  const claims = history.reduce((n, row) => n + (row.claims || 0), 0)
  const flagged = history.filter((row) =>
    ['false', 'misleading'].includes(row.label)
  ).length
  const avgConfidence = runs
    ? Math.round(
        (history.reduce((n, row) => n + (row.confidence || 0), 0) / runs) * 100
      )
    : 0

  const counts = Object.fromEntries(LABELS.map((l) => [l, 0]))
  history.forEach((row) => {
    counts[row.label] = (counts[row.label] || 0) + 1
  })

  const latest = history[0]

  return (
    <section className="page">
      <div className="top">
        <div>
          <div className="eyebrow">TRUST OPERATIONS / LIVE</div>
          <div className="h1">See the claim. Trace the context.</div>
          <div className="muted">
            A multimodal workflow for text, links, images and videos—built
            around AI-03.
          </div>
        </div>
        <select className="pill" aria-label="Interface language">
          <option>English</option>
          <option>हिन्दी</option>
          <option>मराठी</option>
          <option>தமிழ்</option>
          <option>বাংলা</option>
        </select>
      </div>

      <Card className={running ? 'scanline' : ''}>
        <div className="row">
          <div className="section">Quick check</div>
          <span className="tag">Live pipeline</span>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste a forwarded message or claim to check it right here…"
          disabled={running}
        />
        <div className="actions">
          <button className="btn primary" onClick={quickCheck} disabled={running}>
            {running ? 'Analyzing… (can take a minute)' : 'Check claim ↗'}
          </button>
          <button className="btn" onClick={() => go('analyze')}>
            Links, images &amp; video →
          </button>
        </div>
        {error && <p className="red small">{error}</p>}
      </Card>

      <div className="grid metrics" style={{ marginTop: 16 }}>
        <Card>
          <div className="label">Checks run</div>
          <Metric value={runs} />
          <span className="muted">In this browser</span>
        </Card>
        <Card>
          <div className="label">Claims screened</div>
          <Metric value={claims} />
          <span className="muted">Check-worthy claims found</span>
        </Card>
        <Card>
          <div className="label">Flagged false / misleading</div>
          <Metric value={flagged} className={flagged ? 'red' : ''} />
          <span className="muted">
            {runs ? `${Math.round((flagged / runs) * 100)}% of checks` : 'No checks yet'}
          </span>
        </Card>
        <Card>
          <div className="label">Average confidence</div>
          <Metric value={avgConfidence} suffix="%" />
          <span className="muted">Below 30% is reported as false</span>
        </Card>
      </div>

      <div className="grid two">
        <Card>
          <div className="section">Latest case</div>
          {latest ? (
            <>
              <div className="small muted">
                {latest.type} · {new Date(latest.at).toLocaleString()} ·{' '}
                {latest.evidence} evidence item(s)
              </div>
              <div className="claim">“{latest.claim || 'Untitled input'}”</div>
              <div className="row" style={{ marginTop: 12 }}>
                <b className={labelClass(latest.label)}>
                  {latest.label.toUpperCase()}
                </b>
                <span className="small muted">
                  confidence {pct(latest.confidence)}%
                </span>
              </div>
              <div style={{ marginTop: 10 }}>
                <Bar value={pct(latest.confidence)} />
              </div>
              <div className="actions">
                <button className="btn primary" onClick={() => go('analyze')}>
                  Open full result →
                </button>
                <button className="btn" onClick={() => go('evidence')}>
                  Evidence fusion
                </button>
              </div>
            </>
          ) : (
            <p className="muted">
              No checks yet. Run a quick check above or open Multimodal
              analysis to see a real case here.
            </p>
          )}
        </Card>

        <Card>
          <div className="section">System status</div>
          <SystemStatus {...health} />
        </Card>
      </div>

      <Card className="scanline" style={{ marginTop: 16 }}>
        <div className="row">
          <div>
            <div className="section">Evidence graph</div>
            <p className="small muted">
              Each claim is linked to the evidence found for it, coloured by
              whether that source supports or refutes it, with numbered
              citations below.
            </p>
          </div>
          <span className="tag">
            {result && result.graph ? 'Latest run' : 'Sample · run a check'}
          </span>
        </div>
        {result && result.graph ? <GraphBuilder data={result} /> : <EvidenceGraph />}
      </Card>

      <div className="grid two" style={{ marginTop: 16 }}>
        <Card>
          <div className="section">Verdict breakdown</div>
          {runs ? (
            LABELS.map((label) => (
              <div key={label} style={{ marginBottom: 10 }}>
                <div className="signal">
                  <span className={labelClass(label)}>{label}</span>
                  <b className="small">{counts[label]}</b>
                </div>
                <Bar value={Math.round((counts[label] / runs) * 100)} />
              </div>
            ))
          ) : (
            <p className="small muted">Appears after your first check.</p>
          )}
        </Card>

        <Card>
          <div className="row">
            <div className="section">Recent checks</div>
            {runs > 0 && (
              <button className="btn ghost" onClick={onClear}>
                Clear
              </button>
            )}
          </div>
          {runs ? (
            <div className="list">
              {history.slice(0, 6).map((row) => (
                <div className="item history-row" key={row.at}>
                  <b className={labelClass(row.label)}>{row.label}</b>
                  <span className="small">{trim(row.claim, 70)}</span>
                  <span className="small muted">{pct(row.confidence)}%</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="small muted">Nothing checked yet.</p>
          )}
        </Card>
      </div>

      <div className="grid three" style={{ marginTop: 16 }}>
        <Card>
          <div className="label">Core innovation</div>
          <h3>Time-aware verification</h3>
          <p className="small muted">
            Catch old news, recycled images, and stale links shared as current.
          </p>
        </Card>
        <Card>
          <div className="label">India-first layer</div>
          <h3>Code-mixed claims</h3>
          <p className="small muted">
            Preserve original text while normalizing Hinglish and Indic-script
            variants.
          </p>
        </Card>
        <Card>
          <div className="label">Safety principle</div>
          <h3>Explain, don’t amplify</h3>
          <p className="small muted">
            Corrections lead with verified context instead of repeating harmful
            rumors.
          </p>
        </Card>
      </div>
    </section>
  )
}

function trim(text, n) {
  const value = String(text || '')
  return value.length > n ? value.slice(0, n - 1) + '…' : value
}

/** Every model and retriever the server reports, on or off. */
function SystemStatus({ health, failed }) {
  if (failed) {
    return <p className="red small">API offline — the checks cannot run.</p>
  }

  if (!health) return <p className="small muted">Checking API…</p>

  const rows = [
    ...Object.entries(health.models || {}).map(([k, v]) => ['model', k, v]),
    ...Object.entries(health.retrievers || {}).map(([k, v]) => ['retriever', k, v]),
    ['index', 'image index', health.image_index],
  ]

  return (
    <>
      {rows.map(([kind, name, ready]) => (
        <div className="signal" key={kind + name}>
          <span className="small">
            {name} <span className="muted">· {kind}</span>
          </span>
          <b className={(ready ? 'green' : 'amber') + ' small'}>
            {ready ? 'ready' : 'off'}
          </b>
        </div>
      ))}
      <p className="small muted" style={{ marginTop: 8 }}>
        Retrievers marked “off” need an API key in <code>.env</code>.
      </p>
    </>
  )
}
