/*
 * The runs this browser has made, so the command centre can show real
 * numbers instead of invented ones.
 *
 * Only a small summary of each run is kept (not the packet or the
 * graph), and storage failing — a private window, blocked site data —
 * just means the page starts from zero.
 */
const KEY = 'verilens.history.v1'
const MAX = 50

export function loadHistory() {
  try {
    const rows = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(rows) ? rows : []
  } catch {
    return []
  }
}

function save(rows) {
  try {
    localStorage.setItem(KEY, JSON.stringify(rows))
  } catch {
    /* storage unavailable: history lives for this session only */
  }
}

/** One finished run, reduced to what the dashboard shows. */
export function summarize(data, inputType) {
  const nodes = (data.graph && data.graph.nodes) || []
  const results = data.results || []

  return {
    at: Date.now(),
    type: inputType || (data.packet && data.packet.input_type) || 'text',
    label: String(data.verdict.label),
    confidence: Number(data.verdict.confidence) || 0,
    claim:
      (results[0] && results[0].claim) ||
      (data.packet && (data.packet.text || data.packet.url)) ||
      '',
    claims: results.length,
    evidence: nodes.filter((n) => n.kind === 'evidence').length,
    ms: Math.round(data.ms || 0),
  }
}

export function addToHistory(rows, entry) {
  const next = [entry, ...rows].slice(0, MAX)
  save(next)
  return next
}

export function clearHistory() {
  save([])
  return []
}
