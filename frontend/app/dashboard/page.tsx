'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { mockData } from '@/lib/mockdata'
import RiskScore from '@/components/RiskScore'
import SectorChart from '@/components/SectorChart'
import StakeholderCard from '@/components/StakeholderCard'
import { SimulationResult } from '@/lib/types'
import Link from 'next/link'
import Recommendations from '@/components/Recommendations'
import ExportButton from '@/components/ExportButton'
import TimelineChart from '@/components/TimelineChart'
import IndiaMap from '@/components/IndiaMap'
import RiskBreakdown from '@/components/RiskBreakdown'
import TwoStageScenarioCard from '@/components/TwoStageScenarioCard'
import RiskEvidence from '@/components/RiskEvidence'
import MonteCarloFanChart from '@/components/MonteCarloFanChart'
import { runMonteCarlo } from '@/lib/api'
import { Plus, Search } from 'lucide-react'

type TabId = 'overview' | 'sectors' | 'regional' | 'timeline' | 'recommendations'

export default function Dashboard() {
  const [data, setData] = useState<SimulationResult>(mockData)
  const [isReal, setIsReal] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [searchQuery, setSearchQuery] = useState('')
  const [mcError, setMcError] = useState(false)

   /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const stored = localStorage.getItem('simulationResult')
    if (stored) {
      try {
        setData(JSON.parse(stored))
        setIsReal(true)
      } catch (err) {
        console.error('Failed to parse simulationResult from localStorage:', err)
      }
    }
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Older stored results (and the demo data) have no Monte Carlo block, so
  // request one from the backend. On failure a notice is shown instead.
  useEffect(() => {
    if (data.monte_carlo || !data.risk_dimensions) return
    let cancelled = false
    runMonteCarlo(data.risk_dimensions, data.stakeholders)
      .then((mc) => {
        if (!cancelled) setData((d) => ({ ...d, monte_carlo: mc }))
      })
      .catch(() => {
        if (!cancelled) setMcError(true)
      })
    return () => {
      cancelled = true
    }
  }, [data.monte_carlo, data.risk_dimensions, data.stakeholders])

  const rerunMonteCarlo = async (nTrials: number) => {
    if (!data.risk_dimensions) return
    const mc = await runMonteCarlo(data.risk_dimensions, data.stakeholders, nTrials)
    setData((d) => ({ ...d, monte_carlo: mc }))
  }

  const filteredStates = data.states.filter((s) =>
    s.state.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'sectors', label: 'Sectors' },
    { id: 'regional', label: 'States' },
    { id: 'timeline', label: 'Forecast' },
    { id: 'recommendations', label: 'Recommendations' },
  ] as const

  const riskLevel =
    data.risk_level ?? (data.overall_risk_score > 70 ? 'High' : data.overall_risk_score > 40 ? 'Medium' : 'Low')
  const topStates = [...data.states].sort((a, b) => b.impact_score - a.impact_score).slice(0, 3)

  const panel = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
    transition: { duration: 0.25 },
  }

  const scoreTone = (score: number) =>
    score > 70 ? { bar: 'bg-brand-500', text: 'text-brand-700' } : score > 40 ? { bar: 'bg-brand-300', text: 'text-slate-900' } : { bar: 'bg-slate-300', text: 'text-slate-600' }

  return (
    <div className="max-w-[1320px] mx-auto px-5 lg:px-10 pt-6 pb-20 space-y-8">
      {/* Header */}
      <header className="grid lg:grid-cols-12 gap-8 items-end">
        <div className="lg:col-span-8">
          <p className={`inline-flex items-center gap-2 text-sm ${isReal ? 'text-slate-700' : 'text-amber-700'}`}>
            <span className={`w-2 h-2 rounded-full ${isReal ? 'bg-emerald-500' : 'bg-amber-500'}`} aria-hidden="true" />
            {isReal ? 'Live analysis of your upload' : 'Demo data. Upload a policy to see your own results.'}
          </p>
          <h1 className="mt-3 text-[clamp(2rem,4.2vw,3.5rem)] leading-[1.02] font-medium tracking-[-0.03em] text-slate-900 max-w-[22ch]">
            {data.policy_title}
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            Run {data.id}
            <span className="mx-2 text-slate-300">/</span>
            {data.monte_carlo ? `${data.monte_carlo.n_trials.toLocaleString()} Monte Carlo trials` : 'Monte Carlo pending'}
          </p>
        </div>
        <div className="lg:col-span-4 flex flex-wrap lg:justify-end gap-3">
          <ExportButton data={data} />
          <Link href="/upload" className="btn btn-ink">
            <Plus className="w-4 h-4" aria-hidden="true" />
            New analysis
          </Link>
        </div>
      </header>

      {/* Headline numbers */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-label="Key results">
        <div className="card p-6 col-span-2 lg:col-span-1 bg-slate-900! text-white border-transparent!">
          <p className="text-sm text-white/60">Overall risk</p>
          <p className="mt-6 text-6xl font-medium tracking-tight leading-none tabular-nums">
            {data.overall_risk_score}
            <span className="text-xl text-white/40">/100</span>
          </p>
          <p className="mt-3 inline-flex items-center gap-2 text-sm">
            <span className={`w-2 h-2 rounded-full ${riskLevel === 'High' ? 'bg-brand-500' : riskLevel === 'Medium' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            {riskLevel} risk
          </p>
        </div>
        <div className="card p-6">
          <p className="text-sm text-slate-500">Sectors analysed</p>
          <p className="mt-6 text-5xl font-medium tracking-tight leading-none tabular-nums">{data.sectors.length}</p>
          <p className="mt-3 text-sm text-slate-600">{data.sectors.filter((s) => s.sentiment === 'negative').length} with negative impact</p>
        </div>
        <div className="card p-6">
          <p className="text-sm text-slate-500">Stakeholder groups</p>
          <p className="mt-6 text-5xl font-medium tracking-tight leading-none tabular-nums">{data.stakeholders.length}</p>
          <p className="mt-3 text-sm text-slate-600">{data.stakeholders.filter((s) => s.severity === 'high').length} highly affected</p>
        </div>
        <div className="card p-6 col-span-2 lg:col-span-1">
          <p className="text-sm text-slate-500">Most affected states</p>
          <ul className="mt-4 space-y-2.5">
            {topStates.map((s) => (
              <li key={s.state} className="flex items-center justify-between text-sm">
                <span className="text-slate-800">{s.state}</span>
                <span className={`font-medium ${scoreTone(s.impact_score).text}`}>{s.impact_score}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Tabs */}
      <nav aria-label="Dashboard sections" className="flex items-center gap-1 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative shrink-0 px-4 py-2 rounded-xl text-sm transition-colors ${
                isActive ? 'text-slate-900' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="dashboardTab"
                  className="absolute inset-0 bg-white rounded-xl shadow-[0_1px_2px_rgba(31,26,26,0.06)]"
                  transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                />
              )}
              <span className="relative">{tab.label}</span>
            </button>
          )
        })}
      </nav>

      <AnimatePresence mode="wait" initial={false}>
        {activeTab === 'overview' && (
          <motion.div key="overview" {...panel} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <RiskScore score={data.overall_risk_score} />
              <div className="lg:col-span-2">
                <SectorChart sectors={data.sectors} />
              </div>
            </div>

            <RiskBreakdown dimensions={data.risk_dimensions} explanation={data.score_explanation} />

            <TwoStageScenarioCard scenario={data.two_stage_scenario} />

            <RiskEvidence
              details={data.risk_dimension_details}
              contributions={data.risk_contributions}
              confidence={data.risk_confidence}
              models={data.risk_models_used}
            />

            {data.timeline && data.timeline.length > 0 && <TimelineChart timeline={data.timeline} />}

            <section className="card p-7">
              <div className="flex items-baseline justify-between gap-4 mb-6">
                <h2 className="text-xl font-medium tracking-tight text-slate-900">Who is affected</h2>
                <span className="text-sm text-slate-500">{data.stakeholders.length} groups</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.stakeholders.map((s, i) => (
                  <StakeholderCard key={i} stakeholder={s} />
                ))}
              </div>
            </section>

            {data.recommendations && data.recommendations.length > 0 && (
              <Recommendations recommendations={data.recommendations} />
            )}
          </motion.div>
        )}

        {activeTab === 'sectors' && (
          <motion.div key="sectors" {...panel} className="space-y-6">
            <SectorChart sectors={data.sectors} />
            <RiskBreakdown dimensions={data.risk_dimensions} explanation={data.score_explanation} />
          </motion.div>
        )}

        {activeTab === 'regional' && (
          <motion.div key="regional" {...panel} className="space-y-6">
            <IndiaMap states={data.states} />

            <section className="card p-7">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <h2 className="text-xl font-medium tracking-tight text-slate-900">Impact by state</h2>
                <label className="relative">
                  <span className="sr-only">Filter states</span>
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
                  <input
                    type="text"
                    placeholder="Filter states"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 h-11 bg-slate-100 rounded-xl text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[var(--signal)] w-full sm:w-64"
                  />
                </label>
              </div>

              {filteredStates.length === 0 ? (
                <p className="text-sm text-slate-600 py-6">No states match “{searchQuery}”. Check the spelling or clear the filter.</p>
              ) : (
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-10">
                  {filteredStates.map((s) => {
                    const tone = scoreTone(s.impact_score)
                    return (
                      <li key={s.state} className="flex items-center justify-between gap-4 py-3.5 border-b border-black/5">
                        <span className="text-sm text-slate-800">{s.state}</span>
                        <span className="flex items-center gap-4">
                          <span className="w-32 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <span className={`block h-full rounded-full ${tone.bar}`} style={{ width: `${s.impact_score}%` }} />
                          </span>
                          <span className={`text-sm font-medium w-8 text-right ${tone.text}`}>{s.impact_score}</span>
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </motion.div>
        )}

        {activeTab === 'timeline' && (
          <motion.div key="timeline" {...panel} className="space-y-6">
            {data.timeline && <TimelineChart timeline={data.timeline} />}
            {data.monte_carlo ? (
              <MonteCarloFanChart data={data.monte_carlo} onRerun={rerunMonteCarlo} />
            ) : (
              <div className="card p-7 text-sm text-slate-600">
                {mcError
                  ? 'Monte Carlo analysis is unavailable because the backend /simulate endpoint didn’t respond. Start the backend and reload this page.'
                  : data.risk_dimensions
                    ? 'Running the Monte Carlo simulation…'
                    : 'Upload a policy to run the Monte Carlo analysis.'}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'recommendations' && (
          <motion.div key="recommendations" {...panel} className="space-y-6">
            {data.recommendations && <Recommendations recommendations={data.recommendations} />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
