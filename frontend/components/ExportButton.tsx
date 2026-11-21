'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { SimulationResult } from '@/lib/types'
import jsPDF from 'jspdf'
import { Download, CheckCircle, Loader2 } from 'lucide-react'

type RGB = [number, number, number]

const INK: RGB = [30, 41, 59]
const MUTED: RGB = [100, 116, 139]
const TRACK: RGB = [226, 232, 240]
const RED: RGB = [222, 69, 64]
const AMBER: RGB = [217, 160, 20]
const GREEN: RGB = [47, 143, 91]
const GREY: RGB = [148, 163, 184]
const NAVY: RGB = [15, 23, 42]

const MARGIN = 14
const BOTTOM = 280

/** jsPDF's built-in fonts only cover Latin-1, so swap anything else for a safe equivalent. */
const clean = (v: unknown): string =>
  String(v ?? '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/₹/g, 'Rs.')
    .replace(/[\u2010-\u2012\u2015\u2212]/g, '-')   // non-breaking / figure hyphens and minus sign (the AI uses these)
    .replace(/[\u2007-\u200A\u202F]/g, ' ')          // thin / figure spaces
    .replace(/[\u00AD\u200B-\u200D\uFEFF]/g, '')     // soft hyphen and zero-width characters
    .replace(/[^\x00-\xFF]/g, '')

const riskColor = (score: number): RGB => (score >= 70 ? RED : score >= 40 ? AMBER : GREEN)
const priorityColor = (p: string): RGB => (p === 'high' ? RED : p === 'medium' ? AMBER : GREEN)

function buildPdf(data: SimulationResult): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const contentW = W - MARGIN * 2
  let y = 0

  const color = (c: RGB) => doc.setTextColor(c[0], c[1], c[2])
  const fill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2])

  /** Start a new page if `h` mm will not fit on this one. */
  const ensure = (h: number) => {
    if (y + h > BOTTOM) {
      doc.addPage()
      y = 20
    }
  }

  const heading = (text: string) => {
    ensure(18)
    y += 4
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    color(INK)
    doc.text(clean(text), MARGIN, y)
    y += 2
    doc.setDrawColor(TRACK[0], TRACK[1], TRACK[2])
    doc.line(MARGIN, y, W - MARGIN, y)
    y += 6
  }

  const subheading = (text: string) => {
    ensure(10)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    color(INK)
    doc.text(clean(text), MARGIN, y)
    y += 5
  }

  /** Wrapped paragraph that flows across pages line by line. */
  const paragraph = (
    text: string,
    opts: { size?: number; bold?: boolean; c?: RGB; indent?: number; gap?: number } = {},
  ) => {
    const { size = 9.5, bold = false, c = INK, indent = 0, gap = 2 } = opts
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    color(c)
    const lineH = size * 0.42 + 1
    const lines = doc.splitTextToSize(clean(text), contentW - indent) as string[]
    for (const line of lines) {
      ensure(lineH)
      doc.text(line, MARGIN + indent, y)
      y += lineH
    }
    y += gap
  }

  /** Label on the left, value on the right, bar underneath. */
  const barRow = (label: string, valueText: string, pct: number, c: RGB, note?: string) => {
    ensure(note ? 16 : 11)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    color(INK)
    doc.text(clean(label), MARGIN, y)
    doc.setFont('helvetica', 'bold')
    doc.text(clean(valueText), W - MARGIN, y, { align: 'right' })
    y += 2.5
    fill(TRACK)
    doc.roundedRect(MARGIN, y, contentW, 2.2, 1, 1, 'F')
    fill(c)
    const w = Math.max(0, Math.min(100, pct)) / 100 * contentW
    if (w > 0.5) doc.roundedRect(MARGIN, y, w, 2.2, 1, 1, 'F')
    y += note ? 5.5 : 8
    if (note) paragraph(note, { size: 8.5, c: MUTED, gap: 2.5 })
  }

  /** Simple table: fixed column widths (mm), header row, repeats header on a new page. */
  const table = (headers: string[], widths: number[], rows: string[][]) => {
    const headRow = () => {
      ensure(8)
      fill([241, 245, 249])
      doc.rect(MARGIN, y - 4.2, contentW, 6.2, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      color(MUTED)
      let x = MARGIN + 1.5
      headers.forEach((h, i) => {
        doc.text(clean(h), x, y)
        x += widths[i]
      })
      y += 5
    }
    headRow()
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    for (const row of rows) {
      const cells = row.map((cell, i) => doc.splitTextToSize(clean(cell), widths[i] - 3) as string[])
      const lines = Math.max(...cells.map((c) => c.length))
      const h = lines * 4.2 + 1.5
      if (y + h > BOTTOM) {
        doc.addPage()
        y = 20
        headRow()
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
      }
      color(INK)
      let x = MARGIN + 1.5
      cells.forEach((c, i) => {
        doc.text(c, x, y)
        x += widths[i]
      })
      y += h
      doc.setDrawColor(TRACK[0], TRACK[1], TRACK[2])
      doc.line(MARGIN, y - 3, W - MARGIN, y - 3)
    }
    y += 3
  }

  /* ---------------- Cover header ---------------- */
  fill(NAVY)
  doc.rect(0, 0, W, 36, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('PolicySim - Executive Intelligence Report', MARGIN, 18)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.text(`Generated ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`, MARGIN, 27)
  y = 50

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  color(INK)
  const titleLines = doc.splitTextToSize(clean(data.policy_title), contentW) as string[]
  titleLines.forEach((l) => {
    doc.text(l, MARGIN, y)
    y += 7
  })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  color(MUTED)
  doc.text(`Simulation ID: ${clean(data.id)}`, MARGIN, y)
  y += 10

  /* ---------------- Overall risk ---------------- */
  const level = data.risk_level ?? (data.overall_risk_score >= 70 ? 'High' : data.overall_risk_score >= 40 ? 'Medium' : 'Low')
  fill(riskColor(data.overall_risk_score))
  doc.roundedRect(MARGIN, y, 52, 16, 3, 3, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text(`${data.overall_risk_score} / 100`, MARGIN + 5, y + 10.5)
  doc.setFontSize(11)
  color(INK)
  doc.text(`${level} risk`, MARGIN + 58, y + 7)
  if (data.risk_confidence) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    color(MUTED)
    doc.text(`Rater confidence: ${data.risk_confidence}`, MARGIN + 58, y + 13)
  }
  y += 24

  /* ---------------- Key numbers ---------------- */
  const topStates = [...(data.states ?? [])].sort((a, b) => b.impact_score - a.impact_score).slice(0, 3)
  paragraph(
    `${data.sectors.length} sectors analysed (${data.sectors.filter((s) => s.sentiment === 'negative').length} negative)  |  ` +
      `${data.stakeholders.length} stakeholder groups (${data.stakeholders.filter((s) => s.severity === 'high').length} highly affected)` +
      (topStates.length ? `  |  Most affected: ${topStates.map((s) => `${s.state} (${s.impact_score})`).join(', ')}` : ''),
    { size: 9, c: MUTED },
  )

  if (data.scoring_warnings?.length) {
    subheading('Scoring notes')
    data.scoring_warnings.forEach((w) => paragraph(`- ${w}`, { size: 8.5, c: AMBER, indent: 2, gap: 1 }))
  }

  /* ---------------- Risk breakdown ---------------- */
  if (data.risk_dimensions) {
    heading('Risk breakdown')
    const labels: Record<string, string> = {
      severity: 'Severity of side-effects',
      plausibility: 'Plausibility',
      magnitude: 'Magnitude (reach)',
      vulnerable_population: 'Vulnerable population',
    }
    Object.entries(data.risk_dimensions).forEach(([k, v]) => {
      const contrib = data.risk_contributions?.[k]
      barRow(labels[k] ?? k, `${v}/100`, v, riskColor(v), contrib !== undefined ? `Contributes ${contrib} points to the overall score.` : undefined)
    })
    if (data.score_explanation) paragraph(data.score_explanation, { size: 9, c: MUTED })
  }

  /* ---------------- Scenario ---------------- */
  if (data.two_stage_scenario) {
    heading('Before and after the policy')
    subheading('Before')
    paragraph(data.two_stage_scenario.stage1_before)
    subheading('After')
    paragraph(data.two_stage_scenario.stage2_after)
  }

  /* ---------------- Evidence behind the ratings ---------------- */
  if (data.risk_dimension_details) {
    heading('Evidence behind the risk ratings')
    if (data.risk_models_used?.length) {
      paragraph(`Rated independently by ${data.risk_models_used.length} raters; the median is used.`, { size: 8.5, c: MUTED })
    }
    Object.entries(data.risk_dimension_details).forEach(([dim, d]) => {
      subheading(`${dim.replace(/_/g, ' ')}: ${d.score}/100  (spread ${d.spread}, ${d.confidence} confidence)`)
      d.ratings.forEach((r) => {
        paragraph(`${r.model} - ${r.score}: ${r.reason}`, { size: 8.5, indent: 2, gap: 0.5 })
        if (r.evidence) {
          const noEvidence = r.evidence.trim().toUpperCase() === 'NO_DIRECT_EVIDENCE'
          const quote = r.evidence.trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')   // the model sometimes adds its own quote marks
          const tag = r.evidence_verified === true ? '  [verified in policy text]'
            : r.evidence_verified === false ? '  [NOT found in policy text]' : ''
          paragraph(noEvidence ? '(no direct evidence cited; score is an inference)' : `"${quote}"${tag}`, { size: 8, c: MUTED, indent: 5, gap: 1.5 })
        }
      })
      y += 1
    })
  }

  /* ---------------- Sectors ---------------- */
  heading('Sector impact')
  data.sectors.forEach((s) => {
    const unrated = s.method === 'unavailable'
    const signed = s.signed_impact ?? (s.sentiment === 'negative' ? -s.score : s.score)
    const c = unrated ? GREY : s.sentiment === 'positive' ? GREEN : s.sentiment === 'negative' ? RED : AMBER
    const valueText = unrated ? 'not rated' : `${signed > 0 ? '+' : ''}${signed} (${s.sentiment})`
    barRow(s.name, valueText, unrated ? 0 : s.score, c, s.reason)
  })

  /* ---------------- Stakeholders ---------------- */
  heading('Who is affected')
  data.stakeholders.forEach((s) => {
    ensure(18)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    color(INK)
    doc.text(clean(s.group), MARGIN, y)
    doc.setFontSize(8.5)
    color(priorityColor(s.severity))
    doc.text(`${s.severity.toUpperCase()} severity${s.effect ? `  |  ${s.effect}` : ''}`, W - MARGIN, y, { align: 'right' })
    y += 4.5
    paragraph(s.impact, { size: 9, indent: 0, gap: 1 })
    if (s.reason) paragraph(s.reason, { size: 8.5, c: MUTED, gap: 1 })
    y += 2
  })

  /* ---------------- States ---------------- */
  if (data.states?.length) {
    heading('Impact by state')
    if (data.scope) {
      paragraph(
        data.scope.type === 'state_specific' && data.scope.states.length
          ? `Policy scope: state-specific (${data.scope.states.join(', ')}).`
          : 'Policy scope: national.',
        { size: 8.5, c: MUTED },
      )
    }
    const sorted = [...data.states].sort((a, b) => b.impact_score - a.impact_score)
    table(
      ['State', 'Impact score', 'Data basis'],
      [90, 40, contentW - 130],
      sorted.map((s) => [s.state, String(s.impact_score), s.data_basis ?? '-']),
    )
  }

  /* ---------------- Timeline ---------------- */
  if (data.timeline?.length) {
    heading('Projected timeline')
    data.timeline.forEach((t) => barRow(t.period, `${t.impact_score}/100`, t.impact_score, riskColor(t.impact_score), t.description))
  }

  /* ---------------- Monte Carlo ---------------- */
  if (data.monte_carlo) {
    const mc = data.monte_carlo
    heading(`Uncertainty analysis (${mc.n_trials.toLocaleString()} Monte Carlo trials)`)
    paragraph(
      `Risk score: mean ${mc.risk_score.mean.toFixed(1)}, median ${mc.risk_score.p50.toFixed(1)}, ` +
        `90% range ${mc.risk_score.p5.toFixed(1)} to ${mc.risk_score.p95.toFixed(1)}.`,
    )
    const pc = (v: number) => `${Math.round(v * 100)}%`
    table(
      ['Probability', 'Value'],
      [120, contentW - 120],
      [
        ['High risk now', pc(mc.probabilities.high_risk_now)],
        ['Medium or worse now', pc(mc.probabilities.medium_or_worse_now)],
        ['High impact at 3 years', pc(mc.probabilities.high_impact_at_3y)],
        ['High impact at 5 years', pc(mc.probabilities.high_impact_at_5y)],
        ['Worst case (95th percentile): now / 3y / 5y', `${mc.worst_case_95.now} / ${mc.worst_case_95.at_3y} / ${mc.worst_case_95.at_5y}`],
      ],
    )
    subheading('Projected impact range over time')
    table(
      ['When', '5th pct', '25th', 'Median', '75th', '95th pct'],
      [40, 28, 28, 28, 28, contentW - 152],
      mc.fan.map((f) => [f.label, f.p5.toFixed(0), f.p25.toFixed(0), f.p50.toFixed(0), f.p75.toFixed(0), f.p95.toFixed(0)]),
    )
    if (mc.sensitivity?.length) {
      subheading('What drives the uncertainty')
      mc.sensitivity.slice(0, 6).forEach((s) =>
        barRow(s.input.replace(/^risk_dim:/, 'risk: ').replace(/^model:/, 'model: ').replace(/_/g, ' '), s.correlation.toFixed(2), Math.abs(s.correlation) * 100, s.correlation >= 0 ? RED : GREEN),
      )
    }
    paragraph(
      `Assumptions: ${mc.assumptions.method}. These spreads are stated assumptions, not calibrated to historical outcomes, so read the ranges as a guide and not as a forecast.`,
      { size: 8.5, c: MUTED },
    )
  }

  /* ---------------- Recommendations ---------------- */
  if (data.recommendations?.length) {
    heading('Recommendations')
    data.recommendations.forEach((r, i) => {
      ensure(18)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      color(INK)
      const titleW = contentW - 40
      const t = doc.splitTextToSize(clean(`${i + 1}. ${r.title}`), titleW) as string[]
      doc.text(t[0], MARGIN, y)
      doc.setFontSize(8.5)
      color(priorityColor(r.priority))
      doc.text(`${r.priority.toUpperCase()}  |  ${clean(r.sector)}`, W - MARGIN, y, { align: 'right' })
      y += 4.5
      paragraph(r.description, { size: 9, gap: 3 })
    })
  }

  if (data.scoring_method?.note) {
    heading('Method')
    paragraph(data.scoring_method.note, { size: 8.5, c: MUTED })
  }

  /* ---------------- Footer on every page ---------------- */
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    color(MUTED)
    doc.text('PolicySim - AI-assisted analysis; verify against the source policy before use.', MARGIN, 290)
    doc.text(`Page ${p} of ${pages}`, W - MARGIN, 290, { align: 'right' })
  }

  return doc
}

export default function ExportButton({ data }: { data: SimulationResult }) {
  const [exporting, setExporting] = useState(false)
  const [done, setDone] = useState(false)

  const handleExport = () => {
    setExporting(true)
    // Let the "Generating..." state paint before the (synchronous) PDF work starts.
    setTimeout(() => {
      try {
        const doc = buildPdf(data)
        const name = clean(data.policy_title).replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '') || 'policy'
        doc.save(`${name}_analysis.pdf`)
        setDone(true)
        setTimeout(() => setDone(false), 2500)
      } catch (err) {
        console.error('PDF export failed', err)
      } finally {
        setExporting(false)
      }
    }, 100)
  }

  return (
    <motion.button
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      onClick={handleExport}
      disabled={exporting}
      className="btn btn-plain disabled:opacity-60"
    >
      {exporting ? (
        <Loader2 className="w-4 h-4 animate-spin " />
      ) : done ? (
        <CheckCircle className="w-4 h-4 " />
      ) : (
        <Download className="w-4 h-4 " />
      )}
      <span>{exporting ? 'Generating PDF...' : done ? 'Downloaded!' : 'Export PDF Report'}</span>
    </motion.button>
  )
}