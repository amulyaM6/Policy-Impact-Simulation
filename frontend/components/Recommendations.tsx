'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Recommendation } from '@/lib/types'
import { Lightbulb, Check, Copy, AlertCircle, ShieldAlert, CheckCircle2 } from 'lucide-react'

export default function Recommendations({ recommendations }: { recommendations: Recommendation[] }) {
  const [activeFilter, setActiveFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all')
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)

  const filteredRecs = recommendations.filter(r => activeFilter === 'all' || r.priority === activeFilter)

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  const styles = {
    high: {
      card: 'bg-brand-50/40 border-brand-200/80 hover:border-brand-300',
      badge: 'bg-brand-100/90 text-brand-700 border-brand-200',
      icon: ShieldAlert
    },
    medium: {
      card: 'bg-amber-50/40 border-amber-200/80 hover:border-amber-300',
      badge: 'bg-amber-100/90 text-amber-700 border-amber-200',
      icon: AlertCircle
    },
    low: {
      card: 'bg-slate-50/40 border-slate-200/80 hover:border-slate-300',
      badge: 'bg-slate-100/90 text-slate-700 border-slate-200',
      icon: CheckCircle2
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.25 }}
      className="card rounded-2xl p-6 mb-6 shadow-lg shadow-slate-900/5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-900">
            <Lightbulb className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">AI Mitigation Strategies</h2>
            <p className="text-slate-400 text-xs font-medium">Actionable policy adjustment proposals</p>
          </div>
        </div>

        {/* Priority Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/60 self-start sm:self-auto">
          {(['all', 'high', 'medium', 'low'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all ${
                activeFilter === filter
                  ? 'bg-white text-brand-600 shadow-xs border border-slate-200/80'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredRecs.map((r, i) => {
            const s = styles[r.priority] || styles.medium
            const Icon = s.icon

            return (
              <motion.div
                key={r.title + i}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.3 }}
                className={`rounded-2xl p-5 border ${s.card} backdrop-blur-xs flex flex-col justify-between group`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`w-7 h-7 rounded-lg bg-white border border-slate-200/80 flex items-center justify-center shrink-0`}>
                        <Icon className="w-4 h-4 text-brand-600" />
                      </span>
                      <h3 className="text-slate-900 font-semibold text-sm tracking-tight leading-snug">{r.title}</h3>
                    </div>
                    <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${s.badge} shrink-0`}>
                      {r.priority}
                    </span>
                  </div>

                  <p className="text-slate-600 text-xs leading-relaxed font-medium mb-3">{r.description}</p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-200/40 text-[11px]">
                  <span className="text-brand-600 font-bold bg-brand-50 px-2.5 py-0.5 rounded-md border border-brand-100">
                    Sector: {r.sector}
                  </span>
                  <button
                    onClick={() => handleCopy(`${r.title}: ${r.description}`, i)}
                    className="flex items-center gap-1 text-slate-400 hover:text-slate-700 font-semibold transition"
                  >
                    {copiedIdx === i ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedIdx === i ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}