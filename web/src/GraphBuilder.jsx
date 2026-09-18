/*
 * The evidence graph of a real run, drawn from the `graph` the API
 * returns with `?graph=1`.
 *
 * Claims sit in the left column and the evidence retrieved for them in
 * the right, joined by the stance stage 4 recorded (supports, refutes,
 * neutral). Every evidence node carries a citation number, and the list
 * under the drawing is the bibliography: publisher, date, rating, the
 * passage that mattered and a link to the source. Hovering or clicking
 * either side highlights the other.
 */
import { useMemo, useState } from 'react'
import { labelClass, pct } from './api.js'

const WIDTH = 760
const CLAIM = { x: 24, w: 270, h: 74 }
const EVIDENCE = { x: 466, w: 270, h: 58, gap: 16 }
const PAD = 20

const STANCES = ['supports', 'refutes', 'misleading', 'neutral']

const STANCE_CLASS = {
  supports: 'good',
  refutes: 'bad',
  misleading: 'warn',
  neutral: 'core',
}

const STANCE_COLOUR = {
  supports: 'var(--green)',
  refutes: 'var(--red)',
  misleading: 'var(--amber)',
  neutral: '#7b86c8',
}

const VERDICT_CLASS = { false: 'bad', true: 'good' }

function trim(text, n) {
  const value = String(text || '').replace(/\s+/g, ' ').trim()
  return value.length > n ? value.slice(0, n - 1) + '…' : value
}

/** Word-wrap to at most `lines` lines of `width` characters. */
function wrap(text, width, lines) {
  const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ')
  const out = ['']

  for (const word of words) {
    const last = out.length - 1
    if ((out[last] + ' ' + word).trim().length <= width) {
      out[last] = (out[last] + ' ' + word).trim()
    } else if (out.length < lines) {
      out.push(word)
    } else {
      out[last] = trim(out[last] + ' ' + word, width)
      break
    }
  }

  return out
}

/** Graph JSON -> the claims, evidence and links this drawing needs. */
function build(graph, results) {
  const nodes = graph.nodes || []
  const edges = graph.edges || []
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]))

  const verdictByClaim = Object.fromEntries(
    (results || []).map((r) => [r.claim_id, r])
  )

  const claims = nodes
    .filter((n) => n.kind === 'claim' && n.check_worthy !== false)
    .map((n) => ({
      ...n,
      verdict: verdictByClaim[n.id] || { label: n.verdict || 'unverified' },
    }))

  const evidence = nodes.filter((n) => n.kind === 'evidence')
  const cite = Object.fromEntries(evidence.map((n, i) => [n.id, i + 1]))

  // A stance edge runs evidence -> claim and is typed by its stance; the
  // HAS_EVIDENCE edge (claim -> evidence) links pairs no stance was
  // recorded for, which then draw as neutral.
  const links = new Map()

  edges.forEach((e) => {
    const type = String(e.type || '').toLowerCase()

    if (type === 'has_evidence' && byId[e.from]?.kind === 'claim') {
      const key = e.from + '|' + e.to
      if (!links.has(key)) {
        links.set(key, { claim: e.from, evidence: e.to, stance: 'neutral' })
      }
    }

    if (STANCES.includes(type) && byId[e.to]?.kind === 'claim') {
      links.set(e.to + '|' + e.from, {
        claim: e.to,
        evidence: e.from,
        stance: e.misleading ? 'misleading' : type,
        score: e.score,
        note: e.note,
        method: e.method,
      })
    }
  })

  const sources = Object.fromEntries(
    edges
      .filter((e) => e.type === 'FROM_SOURCE')
      .map((e) => [e.from, byId[e.to]])
  )

  return {
    claims,
    evidence: evidence.map((n) => ({
      ...n,
      n: cite[n.id],
      source: sources[n.id],
    })),
    links: [...links.values()].filter(
      (l) => cite[l.evidence] && claims.some((c) => c.id === l.claim)
    ),
  }
}

export default function GraphBuilder({ data }) {
  const [focus, setFocus] = useState(null)
  const [pinned, setPinned] = useState(null)

  const model = useMemo(
    () => (data && data.graph && data.graph.nodes ? build(data.graph, data.results) : null),
    [data]
  )

  if (!model) {
    return (
      <p className="small muted">
        This run was made without the explanation graph. Tick “Explanation
        graph” and run the check again to see the evidence and citations.
      </p>
    )
  }

  const { claims, evidence, links } = model
  const active = pinned || focus

  const rows = Math.max(evidence.length, 1)
  const height = Math.max(
    PAD * 2 + rows * EVIDENCE.h + (rows - 1) * EVIDENCE.gap,
    PAD * 2 + claims.length * (CLAIM.h + 20),
    150
  )

  const evidenceY = (i) => PAD + i * (EVIDENCE.h + EVIDENCE.gap)
  const claimY = (i) =>
    (height - claims.length * CLAIM.h - (claims.length - 1) * 20) / 2 +
    i * (CLAIM.h + 20)

  const claimIndex = Object.fromEntries(claims.map((c, i) => [c.id, i]))
  const evidenceIndex = Object.fromEntries(evidence.map((e, i) => [e.id, i]))

  const isLit = (link) =>
    active && (active === link.claim || active === link.evidence)

  const hover = (id) => ({
    onPointerEnter: () => setFocus(id),
    onPointerLeave: () => setFocus(null),
    onClick: () => setPinned((p) => (p === id ? null : id)),
  })

  if (!claims.length) {
    return <p className="small muted">No check-worthy claims were found to graph.</p>
  }

  return (
    <div className="graph-builder">
      <div className="graph-legend small">
        {['supports', 'refutes', 'misleading', 'neutral'].map((s) => (
          <span key={s}>
            <i style={{ background: STANCE_COLOUR[s] }} /> {s}
          </span>
        ))}
        <span className="muted">· hover or click a node</span>
      </div>

      <div className="trust-graph">
        <svg
          viewBox={`0 0 ${WIDTH} ${height}`}
          role="img"
          aria-label={`${claims.length} claim(s) linked to ${evidence.length} evidence item(s)`}
        >
          {links.map((link) => {
            const ci = claimIndex[link.claim]
            const ei = evidenceIndex[link.evidence]
            const x1 = CLAIM.x + CLAIM.w
            const y1 = claimY(ci) + CLAIM.h / 2
            const x2 = EVIDENCE.x
            const y2 = evidenceY(ei) + EVIDENCE.h / 2
            const mid = (x1 + x2) / 2

            return (
              <path
                key={link.claim + link.evidence}
                className="edge"
                d={`M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`}
                fill="none"
                style={{
                  stroke: STANCE_COLOUR[link.stance],
                  strokeWidth: isLit(link) ? 3.5 : 2,
                  opacity: active && !isLit(link) ? 0.25 : 1,
                }}
              />
            )
          })}

          {claims.map((claim, i) => {
            const y = claimY(i)
            const label = String(claim.verdict.label)

            return (
              <g key={claim.id} className="node" {...hover(claim.id)}>
                <rect
                  className={`node-${VERDICT_CLASS[label] || 'warn'}`}
                  x={CLAIM.x}
                  y={y}
                  width={CLAIM.w}
                  height={CLAIM.h}
                  rx="14"
                  style={{ strokeWidth: active === claim.id ? 3 : undefined }}
                />
                <text x={CLAIM.x + 14} y={y + 22} style={{ fontSize: 10, fill: '#9fc6d7' }}>
                  CLAIM {i + 1} · {label.toUpperCase()}
                  {claim.verdict.confidence != null
                    ? ` · ${pct(claim.verdict.confidence)}%`
                    : ''}
                </text>
                {wrap(claim.text, 38, 2).map((line, j) => (
                  <text key={j} x={CLAIM.x + 14} y={y + 42 + j * 17}>
                    {line}
                  </text>
                ))}
              </g>
            )
          })}

          {evidence.map((item, i) => {
            const y = evidenceY(i)
            const stance = item.stance || 'neutral'

            return (
              <g key={item.id} className="node" {...hover(item.id)}>
                <rect
                  className={`node-${STANCE_CLASS[stance] || 'core'}`}
                  x={EVIDENCE.x}
                  y={y}
                  width={EVIDENCE.w}
                  height={EVIDENCE.h}
                  rx="12"
                  style={{ strokeWidth: active === item.id ? 3 : undefined }}
                />
                <text x={EVIDENCE.x + 12} y={y + 22}>
                  [{item.n}] {trim(item.publisher || item.domain || 'Source', 30)}
                </text>
                <text x={EVIDENCE.x + 12} y={y + 41} style={{ fontSize: 10, fill: '#c9d6e8' }}>
                  {stance}
                  {item.rating && item.rating !== 'unknown' ? ` · rated ${item.rating}` : ''}
                  {item.published_date ? ` · ${item.published_date}` : ''}
                  {item.demo ? ' · demo' : ''}
                </text>
              </g>
            )
          })}

          {!evidence.length && (
            <text
              x={EVIDENCE.x + EVIDENCE.w / 2}
              y={height / 2}
              textAnchor="middle"
              style={{ fill: 'var(--muted)', fontSize: 12 }}
            >
              No evidence was retrieved
            </text>
          )}
        </svg>
      </div>

      <div className="section" style={{ marginTop: 14 }}>
        Citations
      </div>

      {evidence.length ? (
        <div className="list">
          {evidence.map((item) => {
            const stance = item.stance || 'neutral'
            const lit = active === item.id

            return (
              <div
                key={item.id}
                className="item"
                {...hover(item.id)}
                style={lit ? { borderColor: STANCE_COLOUR[stance] } : undefined}
              >
                <b>[{item.n}]</b>{' '}
                {item.url ? (
                  <a href={item.url} target="_blank" rel="noreferrer">
                    {item.title || item.publisher || item.url}
                  </a>
                ) : (
                  <b>{item.title || item.publisher || 'Untitled source'}</b>
                )}
                <p className="small muted" style={{ margin: '4px 0' }}>
                  {[
                    item.publisher || item.source?.publisher,
                    item.domain,
                    item.published_date && `published ${item.published_date}`,
                    item.rating && item.rating !== 'unknown' && `rating: ${item.rating_raw || item.rating}`,
                    item.source_type,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <span className={'tag ' + labelClass(stanceLabel(stance))}>{stance}</span>
                {item.decisive && <span className="tag">decisive</span>}
                {item.demo && <span className="tag">demo data</span>}
                {item.snippet && <p className="small">“{trim(item.snippet, 280)}”</p>}
              </div>
            )
          })}
        </div>
      ) : (
        <p className="small muted">
          No sources were found for this claim, so there is nothing to cite.
        </p>
      )}
    </div>
  )
}

/** Colour a stance the way the verdict palette colours a label. */
function stanceLabel(stance) {
  return { supports: 'true', refutes: 'false', misleading: 'misleading' }[stance] || 'unverified'
}
