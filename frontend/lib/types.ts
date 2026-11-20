export type Confidence = 'high' | 'medium' | 'low'

export interface SectorScore {
  name: string
  /** strength of the effect, 0-100 (absolute value of signed_impact) */
  score: number
  sentiment: 'positive' | 'negative' | 'neutral'
  data_grounded?: boolean
  /** -100 (harms the sector) .. +100 (helps it): median of the raters */
  signed_impact?: number
  spread?: number
  confidence?: Confidence
  reason?: string
  evidence?: string
  evidence_verified?: boolean | null
  /** 'real' = state scores use a state-level dataset, 'proxy' = stand-in */
  state_data_basis?: 'real' | 'proxy'
  method?: string
}

export interface RiskDimensions {
  severity: number
  plausibility: number
  magnitude: number
  vulnerable_population: number
}

export interface StateDriver {
  sector: string
  weight: number
  vulnerability: number
  basis: 'real' | 'proxy'
  indicator: string
  contribution: number
}

export interface StateImpact {
  state: string
  impact_score: number
  vulnerability?: number
  scope_factor?: number
  data_basis?: 'real' | 'mixed' | 'proxy' | 'missing'
  drivers?: StateDriver[]
}

export interface Stakeholder {
  group: string
  impact: string
  severity: 'high' | 'medium' | 'low'
  /** 0-100 median rater exposure, and the computed severity score */
  exposure?: number
  severity_score?: number
  adaptability?: number
  effect?: 'benefit' | 'harm' | 'mixed'
  confidence?: Confidence
  reason?: string
  evidence?: string
  evidence_verified?: boolean | null
  method?: string
}

export interface Recommendation {
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  sector: string
}

export interface TwoStageScenario {
  stage1_before: string
  stage2_after: string
}

export interface TimelinePoint {
  period: string
  impact_score: number
  description: string
}

export interface FanPoint {
  t_years: number
  label: string
  mean: number
  p5: number
  p10: number
  p25: number
  p50: number
  p75: number
  p90: number
  p95: number
}

export interface MonteCarloResult {
  n_trials: number
  seed: number
  risk_score: {
    mean: number
    std: number
    p5: number
    p10: number
    p50: number
    p90: number
    p95: number
    histogram: { bin_start: number; bin_end: number; share: number }[]
  }
  probabilities: {
    high_risk_now: number
    medium_or_worse_now: number
    high_impact_at_3y: number
    medium_or_worse_at_3y: number
    high_impact_at_5y: number
    medium_or_worse_at_5y: number
  }
  worst_case_95: { now: number; at_3y: number; at_5y: number }
  fan: FanPoint[]
  sensitivity: { input: string; correlation: number }[]
  assumptions: {
    method: string
    risk_dimension_sigma: number
    risk_dimension_correlation: number
    adaptability_sigma: number
    model_structure_rel_sigma: number
  }
}

export interface RaterRating {
  model: string
  score: number
  reason: string
  evidence: string
  evidence_verified: boolean | null
}

export interface DimensionDetail {
  score: number
  spread: number
  evidence_verified_count: number
  confidence: 'high' | 'medium' | 'low'
  ratings: RaterRating[]
}

export interface SimulationResult {
  id: string
  policy_title: string
  overall_risk_score: number
  risk_level?: 'High' | 'Medium' | 'Low'
  risk_dimensions?: RiskDimensions
  score_explanation?: string
  two_stage_scenario?: TwoStageScenario
  shap_importance?: Record<string, number>
  xgboost_prediction?: number
  sectors: SectorScore[]
  states: StateImpact[]
  stakeholders: Stakeholder[]
  recommendations: Recommendation[]
  timeline: TimelinePoint[]
  monte_carlo?: MonteCarloResult
  risk_dimension_details?: Record<keyof RiskDimensions, DimensionDetail>
  risk_confidence?: 'high' | 'medium' | 'low'
  risk_models_used?: string[]
  risk_contributions?: Record<string, number>
  scope?: { type: 'national' | 'state_specific'; states: string[]; method?: string }
  scoring_method?: { note: string; policy_intensity: number }
  scoring_warnings?: string[]
}

export type Winner = 'policy1' | 'policy2' | 'tie'

export interface SectorComparison {
  /** net benefit 0-100: 50 = no effect, higher = more beneficial */
  policy1_score: number
  policy2_score: number
  policy1_summary: string
  policy2_summary: string
  winner: Winner
  policy1_sentiment?: SectorScore['sentiment']
  policy2_sentiment?: SectorScore['sentiment']
  policy1_confidence?: Confidence
  policy2_confidence?: Confidence
  policy1_evidence?: string
  policy2_evidence?: string
}

export interface CompareRisk {
  overall_risk_score: number
  risk_level?: 'High' | 'Medium' | 'Low'
  confidence?: Confidence
  range: { p5: number; p95: number }
  dimensions: RiskDimensions
}

export interface CompareResult {
  policy1_title: string
  policy2_title: string
  common_fields: string[]
  comparison: Record<string, SectorComparison>
  risk?: {
    policy1: CompareRisk
    policy2: CompareRisk
    /** lower is better on every dimension */
    dimension_winners: Record<keyof RiskDimensions, Winner>
  }
  top_states?: {
    policy1: { state: string; impact_score: number }[]
    policy2: { state: string; impact_score: number }[]
  }
  overall_winner: Winner
  overall_winner_reason: string
  method?: { rule: string; note: string }
}