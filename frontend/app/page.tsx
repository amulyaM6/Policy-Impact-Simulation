'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, ChevronDown, TrendingUp } from 'lucide-react'
import IndiaSilhouette from '@/components/IndiaSilhouette'

interface PresetPolicy {
  id: string
  title: string
  category: string
  baseRisk: number
  sectorImpacts: { name: string; score: number; sentiment: 'positive' | 'negative' | 'neutral' }[]
  topAffectedStates: { name: string; score: number }[]
  monteCarloProbability: number
  /** Projected net impact score for years 0–6, used by the hero forecast card. */
  forecast: number[]
  description: string
  shortName: string
}

const PRESET_POLICIES: PresetPolicy[] = [
  {
    id: 'agri-2026',
    shortName: 'Farm subsidy',
    title: 'Agricultural Subsidy & Direct Transfer Act 2026',
    category: 'Agriculture & rural economy',
    baseRisk: 68,
    description: 'Moves chemical fertiliser subsidies into direct cash transfers for 85M smallholder farmers.',
    sectorImpacts: [
      { name: 'Agriculture', score: 88, sentiment: 'positive' },
      { name: 'Economy', score: 65, sentiment: 'neutral' },
      { name: 'Infrastructure', score: 48, sentiment: 'neutral' },
      { name: 'Environment', score: 92, sentiment: 'positive' },
    ],
    topAffectedStates: [
      { name: 'Punjab', score: 94 },
      { name: 'Uttar Pradesh', score: 86 },
      { name: 'Maharashtra', score: 78 },
    ],
    monteCarloProbability: 86.4,
    forecast: [22, 41, 30, 58, 71, 63, 74],
  },
  {
    id: 'ai-compute',
    shortName: 'AI compute',
    title: 'National AI Infrastructure & Compute Grid Bill',
    category: 'Technology',
    baseRisk: 38,
    description: 'Subsidises 10,000 GPU clusters and renewable tariffs for tier-2 and tier-3 tech hubs.',
    sectorImpacts: [
      { name: 'Technology', score: 96, sentiment: 'positive' },
      { name: 'Economy', score: 91, sentiment: 'positive' },
      { name: 'Energy', score: 70, sentiment: 'negative' },
      { name: 'Education', score: 84, sentiment: 'positive' },
    ],
    topAffectedStates: [
      { name: 'Karnataka', score: 98 },
      { name: 'Telangana', score: 93 },
      { name: 'Tamil Nadu', score: 85 },
    ],
    monteCarloProbability: 92.8,
    forecast: [15, 28, 46, 52, 69, 81, 88],
  },
  {
    id: 'green-tariff',
    shortName: 'Carbon tariff',
    title: 'Renewable Storage Mandate & Carbon Tariff 2026',
    category: 'Energy & climate',
    baseRisk: 58,
    description: 'Puts a carbon tariff on heavy manufacturing and requires 25% battery storage on power grids.',
    sectorImpacts: [
      { name: 'Environment', score: 95, sentiment: 'positive' },
      { name: 'Manufacturing', score: 62, sentiment: 'negative' },
      { name: 'Energy', score: 84, sentiment: 'positive' },
      { name: 'Economy', score: 58, sentiment: 'neutral' },
    ],
    topAffectedStates: [
      { name: 'Gujarat', score: 91 },
      { name: 'Maharashtra', score: 85 },
      { name: 'Rajasthan', score: 81 },
    ],
    monteCarloProbability: 81.2,
    forecast: [35, 18, 26, 44, 39, 57, 66],
  },
]

const SECTORS = ['Agriculture', 'Economy', 'Health', 'Infrastructure', 'Education']

/* Smooth line + area through the forecast points, sized to a 280×110 box */
function forecastPaths(values: number[]) {
  const w = 280
  const h = 110
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - (v / 100) * h] as const)
  let line = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]
    const [x1, y1] = pts[i]
    const cx = (x0 + x1) / 2
    line += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`
  }
  const area = `${line} L${w},${h} L0,${h} Z`
  const peakIndex = values.indexOf(Math.max(...values))
  return { line, area, peak: pts[peakIndex], peakIndex }
}

function ForecastCard({ policy }: { policy: PresetPolicy }) {
  const { line, area, peak, peakIndex } = forecastPaths(policy.forecast)
  return (
    <div className="card-glass p-5 w-full">
      <div className="flex items-center justify-between mb-4">
        <span className="flex items-center gap-2 text-sm text-slate-800">
          <TrendingUp className="w-4 h-4" aria-hidden="true" />
          Projected impact
        </span>
        <span className="flex items-center gap-1 text-xs text-slate-600">
          6 years <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
        </span>
      </div>
      <div className="relative">
        <svg viewBox="-4 -4 288 118" className="w-full h-auto overflow-visible" aria-label={`Projected impact peaks at ${policy.forecast[peakIndex]} in year ${peakIndex}`}>
          <defs>
            <linearGradient id="forecast-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#de4540" stopOpacity="0.22" />
              <stop offset="1" stopColor="#de4540" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 55, 110].map((y) => (
            <line key={y} x1="0" x2="280" y1={y} y2={y} stroke="#1f1a1a" strokeOpacity="0.06" />
          ))}
          <path key={`a-${policy.id}`} d={area} fill="url(#forecast-fill)" className="fade-in" />
          <path key={`l-${policy.id}`} d={line} fill="none" stroke="#de4540" strokeWidth="2" pathLength={1} className="draw-in" />
          <circle cx={peak[0]} cy={peak[1]} r="4.5" fill="#fff" stroke="#1f1a1a" strokeWidth="1.5" />
        </svg>
        <span
          className={`absolute -translate-y-full -mt-2 ${peak[0] > 220 ? '-translate-x-full' : peak[0] < 60 ? '' : '-translate-x-1/2'} bg-white border border-black/5 rounded-lg px-2.5 py-1 text-xs text-slate-800 shadow-sm whitespace-nowrap`}
          style={{ left: `${(peak[0] / 280) * 100}%`, top: `${(peak[1] / 110) * 100}%` }}
        >
          Peak {policy.forecast[peakIndex]}
        </span>
      </div>
      <div className="flex justify-between mt-2 text-[11px] text-slate-500">
        {policy.forecast.map((_, i) => (
          <span key={i}>Y{i}</span>
        ))}
      </div>
    </div>
  )
}

export default function Home() {
  const [selected, setSelected] = useState<PresetPolicy>(PRESET_POLICIES[0])

  return (
    <div className="max-w-[1320px] mx-auto px-5 lg:px-10 pb-16">
      <section className="relative grid lg:grid-cols-12 gap-y-10 lg:min-h-[calc(100vh-5rem)] lg:max-h-[900px] pt-6 lg:pt-12">
        {/* Headline column */}
        <div className="lg:col-span-7 relative z-10 flex flex-col">
          <h1 className="display rise text-[clamp(2.75rem,5.6vw,5.2rem)] max-w-[14ch]">See the impact before it becomes law</h1>

          <p className="mt-7 max-w-[30rem] text-base leading-relaxed text-slate-600">
            Upload a draft bill or policy PDF. PolicySim scores its risk, runs 10,000 Monte Carlo trials and
            maps the effect across 28 states and 5 sectors.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/upload" className="btn btn-signal">
              Upload a policy
              <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
            </Link>
            <Link href="/compare" className="btn btn-plain">
              Compare two bills
            </Link>
          </div>

          {/* Sample policy card, bottom left */}
          <div className="mt-10 lg:mt-auto lg:pt-10 lg:mb-10 flex flex-col sm:flex-row gap-5 sm:items-end">
            <div className="card p-5 w-full sm:max-w-[25rem]">
              <p className="text-sm text-slate-500 mb-3">Try a sample policy</p>
              <div role="tablist" aria-label="Sample policies" className="flex flex-wrap gap-1.5 mb-4">
                {PRESET_POLICIES.map((p) => {
                  const active = p.id === selected.id
                  return (
                    <button
                      key={p.id}
                      role="tab"
                      aria-selected={active}
                      onClick={() => setSelected(p)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {p.shortName}
                    </button>
                  )
                })}
              </div>
              <h2 className="text-xl font-medium tracking-tight text-slate-900 leading-snug">{selected.title}</h2>
              <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{selected.description}</p>
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-black/5 pt-4">
                <div>
                  <dt className="text-xs text-slate-500">Risk score</dt>
                  <dd className="text-2xl font-medium tracking-tight">{selected.baseRisk}<span className="text-sm text-slate-400">/100</span></dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Model confidence</dt>
                  <dd className="text-2xl font-medium tracking-tight">{selected.monteCarloProbability}%</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-slate-500">Most affected</dt>
                  <dd className="text-sm text-slate-800 flex items-center gap-1.5 flex-wrap mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-brand-500" aria-hidden="true" />
                    {selected.topAffectedStates.map((s) => s.name).join(', ')}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        {/* Map column */}
        <div className="lg:col-span-5 relative flex flex-col gap-6 lg:block">
          <div
            className="rise rise-late relative aspect-[600/637] lg:aspect-auto lg:absolute lg:inset-0 lg:-left-[30%] lg:right-0 flex items-start justify-center pointer-events-none"
          >
            <IndiaSilhouette highlights={selected.topAffectedStates} className="w-full h-full max-h-[820px]" />
          </div>

          <div className="order-first lg:order-none lg:absolute right-0 top-0 w-full sm:w-[20rem] sm:self-end z-10">
            <ForecastCard policy={selected} />
          </div>

          {/* Most affected states, bottom right */}
          <div className="self-end lg:absolute right-0 bottom-0 lg:bottom-10 z-10 text-right">
            <p className="text-[clamp(2.75rem,4.6vw,4rem)] leading-none font-medium tracking-tight text-slate-900">28</p>
            <p className="text-sm text-slate-600 mt-1">states scored per run</p>
            <div className="mt-4 flex items-center justify-end">
              <ul className="flex -space-x-2.5" aria-label="Sectors covered">
                {SECTORS.map((s, i) => (
                  <li
                    key={s}
                    title={s}
                    className={`w-11 h-11 rounded-full border-2 border-[var(--canvas)] flex items-center justify-center text-xs font-medium ${
                      i % 2 === 0 ? 'bg-brand-100 text-brand-800' : 'bg-white text-slate-800'
                    }`}
                  >
                    {s.slice(0, 2)}
                  </li>
                ))}
              </ul>
              <Link href="/dashboard" aria-label="Open the dashboard" className="icon-round ml-2 w-12 h-12 border-2 border-[var(--canvas)]">
                <ArrowUpRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
