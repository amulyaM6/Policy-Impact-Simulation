'use client'

import { motion } from 'framer-motion'
import { ShieldAlert, ShieldCheck, AlertTriangle } from 'lucide-react'

export default function RiskScore({ score }: { score: number }) {
  const isHigh = score > 70
  const isMedium = score > 40 && score <= 70

  const colorClass = isHigh ? 'text-brand-600' : isMedium ? 'text-amber-600' : 'text-emerald-600'
  const strokeColor = isHigh ? '#de4540' : isMedium ? '#c98a1c' : '#2f8f5b'
  const bgBadge = isHigh ? 'bg-brand-50 border-brand-200 text-brand-700' : isMedium ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
  const label = isHigh ? 'Critical Risk' : isMedium ? 'Moderate Risk' : 'Low Risk Impact'
  const Icon = isHigh ? ShieldAlert : isMedium ? AlertTriangle : ShieldCheck

  // Circle progress calculation
  const radius = 64
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (score / 100) * circumference

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="card rounded-2xl p-7 text-center shadow-lg shadow-slate-900/5 relative overflow-hidden flex flex-col items-center justify-between"
    >

      <div className="w-full flex items-center justify-between mb-2">
        <p className="text-slate-400 text-[11px] font-bold flex items-center gap-1.5">
          
          Overall Risk Index
        </p>
        <span className={`text-[11px] font-bold px-3 py-1 rounded-full border ${bgBadge} flex items-center gap-1`}>
          <Icon className="w-3.5 h-3.5" />
          {label}
        </span>
      </div>

      {/* SVG Radial Circular Progress Bar */}
      <div className="relative my-4 flex items-center justify-center">
        <svg className="w-44 h-44 transform -rotate-90">
          <circle
            cx="88"
            cy="88"
            r={radius}
            stroke="#efedeb"
            strokeWidth="12"
            fill="transparent"
          />
          <motion.circle
            cx="88"
            cy="88"
            r={radius}
            stroke={strokeColor}
            strokeWidth="12"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className={`text-5xl font-semibold tracking-tight ${colorClass}`}
          >
            {score}
          </motion.span>
          <span className="text-[11px] font-bold text-slate-400 mt-0.5">/ 100 Score</span>
        </div>
      </div>

      {/* Score bar indicator */}
      <div className="w-full mt-2">
        <div className="flex justify-between text-xs text-slate-400 mb-1.5 font-medium">
          <span>0 (Safe)</span>
          <span>50</span>
          <span>100 (Hazard)</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2 p-0.5 border border-slate-200/60 overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${isHigh ? 'bg-gradient-to-r from-amber-500 to-brand-600' : isMedium ? 'bg-gradient-to-r from-emerald-500 to-amber-500' : 'bg-gradient-to-r from-slate-500 to-emerald-500'}`}
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 1, delay: 0.3 }}
          />
        </div>
      </div>
    </motion.div>
  )
}