'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, ChevronDown } from 'lucide-react'
import RippleMap from '@/components/RippleMap'
import './landing.css'

interface PresetPolicy {
  id: string
  shortName: string
  title: string
  description: string
  baseRisk: number
  monteCarloProbability: number
  topAffectedStates: { name: string; score: number }[]
  /** Projected net impact score for years 0–6. */
  forecast: number[]
}

const PRESET_POLICIES: PresetPolicy[] = [
  {
    id: 'agri-2026',
    shortName: 'Farm subsidy',
    title: 'Agricultural Subsidy & Direct Transfer Act 2026',
    description: 'Moves chemical fertiliser subsidies into direct cash transfers for 85M smallholder farmers.',
    baseRisk: 68,
    monteCarloProbability: 86.4,
    topAffectedStates: [
      { name: 'Punjab', score: 94 },
      { name: 'Uttar Pradesh', score: 86 },
      { name: 'Maharashtra', score: 78 },
    ],
    forecast: [22, 41, 30, 58, 71, 63, 74],
  },
  {
    id: 'ai-compute',
    shortName: 'AI compute',
    title: 'National AI Infrastructure & Compute Grid Bill',
    description: 'Subsidises 10,000 GPU clusters and renewable tariffs for tier-2 and tier-3 tech hubs.',
    baseRisk: 38,
    monteCarloProbability: 92.8,
    topAffectedStates: [
      { name: 'Karnataka', score: 98 },
      { name: 'Telangana', score: 93 },
      { name: 'Tamil Nadu', score: 85 },
    ],
    forecast: [15, 28, 46, 52, 69, 81, 88],
  },
  {
    id: 'green-tariff',
    shortName: 'Carbon tariff',
    title: 'Renewable Storage Mandate & Carbon Tariff 2026',
    description: 'Puts a carbon tariff on heavy manufacturing and requires 25% battery storage on power grids.',
    baseRisk: 58,
    monteCarloProbability: 81.2,
    topAffectedStates: [
      { name: 'Gujarat', score: 91 },
      { name: 'Maharashtra', score: 85 },
      { name: 'Rajasthan', score: 81 },
    ],
    forecast: [35, 18, 26, 44, 39, 57, 66],
  },
]

const CATEGORIES = ['Agriculture', 'Economy', 'Health', 'Industry', 'Education']

/* Smooth line through the forecast points, in a 160 x 70 box. */
function forecastLine(values: number[]) {
  const w = 160
  const h = 70
  const pad = 6
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - pad - (v / 100) * (h - pad * 2)] as const)
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]
    const [x1, y1] = pts[i]
    const cx = (x0 + x1) / 2
    d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`
  }
  const peak = Math.max(...values)
  const peakY = pts[values.indexOf(peak)][1]
  return { d, peak, peakPct: (peakY / h) * 100 }
}

function ForecastCard({ policy }: { policy: PresetPolicy }) {
  const { d, peak, peakPct } = forecastLine(policy.forecast)
  return (
    <div className="ps-chart">
      <header>
        Projected impact
        <span>
          6 years <ChevronDown className="inline w-2.5 h-2.5" aria-hidden="true" />
        </span>
      </header>
      <div className="ps-chart-plot">
        <svg viewBox="0 0 160 70" aria-label={`Projected impact peaks at ${peak}`}>
          <g stroke="#eee">
            <path d="M0 18H160M0 38H160M0 58H160" />
          </g>
          {/* key restarts the draw-in animation when the policy changes */}
          <path
            key={policy.id}
            className="ps-line"
            d={d}
            pathLength={1}
            fill="none"
            stroke="#dd5250"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
        <span className="ps-peak" style={{ top: `${peakPct}%` }}>
          Peak {peak}
        </span>
      </div>
      <div className="ps-x">
        {policy.forecast.map((_, i) => (
          <span key={i}>Y{i}</span>
        ))}
      </div>
    </div>
  )
}

export default function Home() {
  const [selected, setSelected] = useState<PresetPolicy>(PRESET_POLICIES[0])
  const hot = selected.topAffectedStates.map((s) => s.name)

  return (
    <div className="ps">
      <section className="ps-hero">
        <div className="ps-fade">
          <h1 className="ps-h1">
            See the impact before it <em>becomes law.</em>
          </h1>
          <p className="ps-lead">
            Upload a draft bill or policy PDF. PolicySim scores its risk, runs 10,000 Monte Carlo trials and maps the
            effect across 28 states and 5 sectors.
          </p>
          <div className="ps-cta">
            <Link href="/upload" className="ps-btn ps-btn-red">
              Upload a policy <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
            </Link>
            <Link href="/compare" className="ps-btn ps-btn-white">
              Compare two bills
            </Link>
          </div>
          <div className="ps-meta">
            <span>PDF upload</span>
            <span>10,000 simulations</span>
            <span>One clearer decision</span>
          </div>
          <div className="ps-stats">
            <small>Built to see the bigger picture</small>
            <span>28 states</span>
            <span>5 sectors</span>
          </div>
        </div>

        <div className="ps-card ps-fade" style={{ animationDelay: '.15s' }}>
          <div className="ps-top">
            <span>The policy ripple effect</span>
            <span className="ps-badge">SAMPLE SIMULATION</span>
          </div>
          <RippleMap hot={hot} />
          <div className="ps-legend">Most affected</div>
          <div className="ps-count">
            <b>28</b>
            <span>states scored per run</span>
          </div>
          <ForecastCard policy={selected} />
        </div>
      </section>

      <section className="ps-sample" id="how">
        <div>
          <div className="ps-eyebrow">Explore before you upload</div>
          <h3>Try a sample policy</h3>
          <div className="ps-tabs" role="tablist" aria-label="Sample policies">
            {PRESET_POLICIES.map((p) => (
              <button
                key={p.id}
                role="tab"
                aria-selected={p.id === selected.id}
                onClick={() => setSelected(p)}
              >
                {p.shortName}
              </button>
            ))}
          </div>
          <p className="ps-hint">Explore the trade-offs. See the ripple effect.</p>
        </div>

        <div className="ps-pol">
          <h4>{selected.title}</h4>
          <p>{selected.description}</p>
          <div className="ps-eyebrow">Most affected</div>
          <div className="ps-where">{hot.join(', ')}</div>
        </div>

        <div className="ps-score">
          <div className="ps-score-row">
            <div>
              <small>Risk score</small>
              <b>
                {selected.baseRisk}
                <sup>/100</sup>
              </b>
            </div>
            <div>
              <small>Model confidence</small>
              <b>{selected.monteCarloProbability}%</b>
            </div>
          </div>
          <Link href="/dashboard" className="ps-run">
            <span>Run sample simulation</span>
            <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <footer className="ps-footer" id="method">
        <div>
          <b>PolicySim</b>Better evidence. Better policy.
        </div>
        <div className="ps-cats">
          {CATEGORIES.map((c, i) => (
            <span key={c}>
              {c}
              {i < CATEGORIES.length - 1 ? ' /' : ''}
            </span>
          ))}
        </div>
      </footer>
    </div>
  )
}