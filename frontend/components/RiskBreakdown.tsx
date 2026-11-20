'use client'

import { motion } from 'framer-motion'
import { RiskDimensions } from '@/lib/types'
import { Calculator, ShieldAlert, Layers, Activity, Users2 } from 'lucide-react'

const DIMENSION_CONFIG: Record<keyof RiskDimensions, { label: string; icon: any; description: string }> = {
  severity: { label: 'Severity', icon: ShieldAlert, description: 'Potential severity of unintended policy outcomes' },
  plausibility: { label: 'Plausibility', icon: Activity, description: 'Likelihood based on historical economic data' },
  magnitude: { label: 'Magnitude', icon: Layers, description: 'Overall fiscal & demographic footprint' },
  vulnerable_population: { label: 'Vulnerable Index', icon: Users2, description: 'Proportion of marginal communities affected' },
}

export default function RiskBreakdown({
  dimensions,
  explanation,
}: {
  dimensions?: RiskDimensions
  explanation?: string
}) {
  if (!dimensions) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15 }}
      className="card rounded-2xl p-6 mb-6 shadow-lg shadow-slate-900/5"
    >
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-900">
          <Calculator className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900">Deterministic Risk Dimensions</h2>
          <p className="text-slate-400 text-xs font-medium">Algorithmic risk factor decomposition</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {(Object.keys(dimensions) as (keyof RiskDimensions)[]).map((key, idx) => {
          const value = dimensions[key]
          const config = DIMENSION_CONFIG[key]
          const Icon = config?.icon || Activity
          const colorClass = value > 70 ? 'text-brand-600 bg-brand-500' : value > 40 ? 'text-amber-600 bg-amber-500' : 'text-emerald-600 bg-emerald-500'
          const bgBadge = value > 70 ? 'bg-brand-50 border-brand-200 text-brand-700' : value > 40 ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'

          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: idx * 0.08 }}
              className="bg-slate-50/80 border border-slate-200/70 rounded-xl p-4 flex flex-col justify-between hover:bg-slate-50 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-500 text-xs font-bold flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5 text-brand-600" />
                    {config?.label || key}
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${bgBadge}`}>
                    {value}/100
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug mb-3">{config?.description}</p>
              </div>

              <div>
                <div className="w-full bg-slate-200/70 rounded-full h-2 overflow-hidden">
                  <motion.div
                    className={`h-2 rounded-full ${colorClass.split(' ')[1]}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${value}%` }}
                    transition={{ duration: 0.8, delay: 0.2 + idx * 0.1 }}
                  />
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      {explanation && (
        <div className="bg-brand-50/50 border border-brand-100 rounded-xl p-4 text-xs leading-relaxed text-slate-700">
          <span className="font-semibold text-brand-900 block mb-1">AI Analytical Context:</span>
          {explanation}
        </div>
      )}
    </motion.div>
  )
}