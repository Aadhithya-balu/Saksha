import React, { useState } from 'react';
import {
  ArrowUpRight,
  ChevronDown,
  Clock,
  Compass,
  FileSearch,
  HelpCircle,
  Hexagon,
  MapPin,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import type { UnifiedIntelligenceResult } from '../../services/api';

interface SentinelAlertCardProps {
  pattern: UnifiedIntelligenceResult;
  onInvestigate: (pattern: UnifiedIntelligenceResult) => void;
  onWhyThisInsight: (pattern: UnifiedIntelligenceResult) => void;
  onPlanIntervention: (pattern: UnifiedIntelligenceResult) => void;
}

export const SentinelAlertCard: React.FC<SentinelAlertCardProps> = ({
  pattern,
  onInvestigate,
  onWhyThisInsight,
  onPlanIntervention,
}) => {
  const [showH3Cells, setShowH3Cells] = useState(false);

  // 1. Alert Title formatting
  const rawTitle = pattern.pattern_type || 'Emerging Crime Pattern';
  const alertTitle = rawTitle.toUpperCase().startsWith('EMERGING')
    ? rawTitle.toUpperCase()
    : `EMERGING ${rawTitle.toUpperCase()}`;

  // 2. Jurisdiction
  const district = pattern.location?.district || 'Karnataka State';
  const stations = pattern.location?.stations || [];
  const jurisdictionText = stations.length
    ? `${district} (${stations.slice(0, 3).join(', ')}${stations.length > 3 ? ` +${stations.length - 3}` : ''})`
    : district;

  // 3. Affected H3 Cells
  const h3Cells = pattern.affected_h3_cells || [];

  // 4. Time Window
  const timeWindow = pattern.time_window || 'Window not specified';
  const timeWindowText = timeWindow.replace(/_/g, ' ');

  // 5. Risk Score (e.g. 87/100) — never invent a score when none is provided
  const hasRisk = Number.isFinite(pattern.risk_score);
  const riskNum = hasRisk ? Math.min(100, Math.max(0, Math.round(pattern.risk_score * 100))) : 0;
  const riskDisplay = hasRisk ? `${riskNum}/100` : 'No data';
  const riskBadgeCls = !hasRisk
    ? 'border-[var(--border-primary)] bg-[var(--bg-primary)]/40 text-[var(--text-muted)]'
    : riskNum >= 75
    ? 'border-[#C94A2A]/50 bg-[#C94A2A]/15 text-[#FF6B4A]'
    : riskNum >= 45
    ? 'border-amber-500/50 bg-amber-500/15 text-amber-400'
    : 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400';

  // 6. Confidence (e.g. 87%)
  const hasConfidence = Number.isFinite(pattern.confidence);
  const confNum = hasConfidence ? Math.min(100, Math.max(0, Math.round(pattern.confidence * 100))) : 0;
  const confidenceDisplay = hasConfidence ? `${confNum}%` : 'No data';

  // 7. Change from baseline (e.g. +34%)
  const baseline = pattern.change_from_baseline;
  const hasChange = Boolean(baseline) && Number.isFinite(baseline?.change_percentage);
  const pctChange = hasChange ? Math.round(baseline!.change_percentage || 0) : 0;
  const changeDisplay = hasChange ? `${pctChange >= 0 ? '+' : ''}${pctChange}%` : 'No data';
  const changeIsPositive = hasChange && pctChange >= 0;

  // 8. Forecast — only shown from the real forecast payload
  let forecastDisplay = 'No forecast available';
  if (pattern.forecast) {
    const trendWord =
      pattern.forecast.trend === 'increasing'
        ? 'Elevated'
        : pattern.forecast.trend === 'decreasing'
        ? 'Decreasing'
        : 'Steady';
    const periodWord = pattern.forecast.period
      ? pattern.forecast.period.replace(/_/g, ' ')
      : `${pattern.forecast.predicted_crime_count} incidents predicted`;
    forecastDisplay = `${trendWord} — ${periodWord}`;
  }

  // 9. Pattern Type
  const patternType = pattern.pattern_type || 'Unclassified Pattern';

  // 10. Recommended Action
  const rec = pattern.recommended_action_input;
  const recommendedActionTitle = rec?.title || 'No recommendation generated';
  const recommendedActionDesc = rec?.description || 'No automated recommendation is available for this pattern.';

  return (
    <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]/60 shadow-lg hover:border-[#C94A2A]/40 transition-all duration-200 overflow-hidden select-none">
      {/* Top Banner: Alert Title + Pattern Type + Critical Badges */}
      <div className="p-3.5 border-b border-[var(--border-primary)]/80 bg-gradient-to-r from-[var(--bg-elevated)]/90 via-[var(--bg-secondary)] to-[var(--bg-elevated)]/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border border-[#C94A2A]/50 bg-[#C94A2A]/20 text-[#FF6B4A] shadow-inner">
              <ShieldAlert className="w-4 h-4 animate-pulse" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono font-black tracking-wide text-[var(--text-primary)] flex items-center gap-1.5">
                  🚨 {alertTitle}
                </span>
                <span className="px-1.5 py-0.5 rounded border border-[#a855f7]/40 bg-[#a855f7]/10 text-[#c084fc] text-[7.5px] font-mono uppercase font-bold tracking-wider">
                  {patternType}
                </span>
              </div>
              <p className="flex items-center gap-1 text-[8.5px] font-mono text-[var(--text-muted)] mt-0.5">
                <MapPin className="w-2.5 h-2.5 text-[#C94A2A] shrink-0" />
                <span className="truncate">{jurisdictionText}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
            <span className="text-[7.5px] font-mono uppercase px-2 py-0.5 rounded-full border border-[var(--border-primary)] text-[var(--text-muted)] bg-[var(--bg-primary)]/50 flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {timeWindowText}
            </span>
            {rec?.priority && (
              <span
                className={`text-[7.5px] font-mono uppercase font-bold px-2 py-0.5 rounded-full border ${
                  rec.priority === 'CRITICAL'
                    ? 'border-[#C94A2A]/60 bg-[#C94A2A]/20 text-[#FF6B4A]'
                    : rec.priority === 'HIGH'
                    ? 'border-amber-500/50 bg-amber-500/15 text-amber-400'
                    : 'border-blue-500/40 bg-blue-500/10 text-blue-400'
                }`}
              >
                {rec.priority === 'CRITICAL' ? 'DO NOW' : rec.priority}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Sentinel Core Metrics Strip: Risk, Confidence, Change, Forecast */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 bg-[var(--bg-primary)]/30 border-b border-[var(--border-primary)]/60">
        {/* Metric 1: Risk */}
        <div className={`p-2 rounded-lg border flex flex-col justify-between ${riskBadgeCls}`}>
          <div className="text-[7px] font-mono uppercase tracking-wider font-semibold opacity-85">
            Risk Score
          </div>
          <div className="text-base font-mono font-extrabold tracking-tight mt-0.5">
            {riskDisplay}
          </div>
        </div>

        {/* Metric 2: Confidence */}
        <div className="p-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 flex flex-col justify-between">
          <div className="text-[7px] font-mono uppercase tracking-wider font-semibold opacity-85">
            Confidence
          </div>
          <div className="text-base font-mono font-extrabold tracking-tight mt-0.5">
            {confidenceDisplay}
          </div>
        </div>

        {/* Metric 3: Change from baseline */}
        <div className={`p-2 rounded-lg border flex flex-col justify-between ${
          changeIsPositive
            ? 'border-rose-500/40 bg-rose-500/10 text-rose-400'
            : 'border-blue-500/40 bg-blue-500/10 text-blue-400'
        }`}>
          <div className="text-[7px] font-mono uppercase tracking-wider font-semibold opacity-85">
            Change From Baseline
          </div>
          <div className="text-base font-mono font-extrabold tracking-tight mt-0.5 flex items-center gap-1">
            {changeDisplay}
            <TrendingUp className={`w-3.5 h-3.5 ${!changeIsPositive ? 'rotate-180' : ''}`} />
          </div>
        </div>

        {/* Metric 4: Forecast */}
        <div className="p-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 flex flex-col justify-between">
          <div className="text-[7px] font-mono uppercase tracking-wider font-semibold opacity-85">
            Forecast
          </div>
          <div className="text-[11px] font-mono font-bold tracking-tight mt-1 truncate" title={forecastDisplay}>
            {forecastDisplay}
          </div>
        </div>
      </div>

      {/* Geospatial & Recommended Action Section */}
      <div className="p-3 space-y-2.5">
        {/* Recommended Action Card */}
        <div className="p-2.5 rounded-lg border border-[#1E6FD9]/30 bg-[#1E6FD9]/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[7.5px] font-mono uppercase font-bold text-[#60a5fa] tracking-wider flex items-center gap-1">
              <Compass className="w-3 h-3 text-[#1E6FD9]" /> Recommended Action
            </span>
            <div className="text-[11px] font-semibold text-[var(--text-primary)] mt-0.5">
              {recommendedActionTitle}
            </div>
            <div className="text-[8.5px] text-[var(--text-secondary)] mt-0.5 leading-relaxed line-clamp-1">
              {recommendedActionDesc}
            </div>
          </div>
          <span className="text-[7px] font-mono uppercase px-2 py-0.5 rounded border border-[#1E6FD9]/30 text-[#93c5fd] bg-[#1E6FD9]/10 shrink-0">
            {rec?.action_type || 'Unclassified'}
          </span>
        </div>

        {/* Affected H3 cells collapsible */}
        <div className="rounded-lg border border-[var(--border-primary)]/70 bg-[var(--bg-elevated)]/30 px-2.5 py-1.5">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowH3Cells(!showH3Cells)}
              className="flex items-center gap-1.5 text-[8px] font-mono uppercase text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              <Hexagon className="w-3 h-3 text-[#D4820A]" />
              <span>Affected H3 cells: <strong className="text-[var(--text-primary)]">{h3Cells.length} cells</strong> (res 7)</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${showH3Cells ? 'rotate-180' : ''}`} />
            </button>
            <span className="text-[7.5px] font-mono text-[var(--text-muted)]">
              {pattern.related_fir_ids?.length || 0} linked FIRs
            </span>
          </div>

          {showH3Cells && (
            <div className="mt-2 pt-2 border-t border-[var(--border-primary)]/50">
              <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto custom-scrollbar">
                {h3Cells.length > 0 ? (
                  h3Cells.map((cell) => (
                    <span
                      key={cell}
                      className="px-1.5 py-0.5 rounded bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[7px] font-mono text-[#D4820A]"
                    >
                      {cell}
                    </span>
                  ))
                ) : (
                  <span className="text-[7.5px] font-mono text-[var(--text-muted)]">
                    No specific H3 cells attached (district-wide distribution)
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons: [Investigate] [Why This Insight?] [Plan Intervention] */}
      <div className="px-3 pb-3 pt-1 flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border-primary)]/60 bg-[var(--bg-secondary)]/80">
        {/* 1. Investigate Button (Links to Issue #250) */}
        <button
          onClick={() => onInvestigate(pattern)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-elevated)]/60 text-[8.5px] font-mono uppercase font-bold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] hover:border-[#1E6FD9]/50 transition-all cursor-pointer shadow-sm active:scale-95"
          title="Open investigation dashboard for linked FIRs and criminal entities (Issue #250)"
        >
          <FileSearch className="w-3 h-3 text-[#60a5fa]" />
          <span>Investigate</span>
          <ArrowUpRight className="w-2.5 h-2.5 text-[var(--text-muted)]" />
        </button>

        {/* 2. Why This Insight? Button */}
        <button
          onClick={() => onWhyThisInsight(pattern)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-[8.5px] font-mono uppercase font-bold text-amber-300 hover:bg-amber-500/20 hover:border-amber-500/60 transition-all cursor-pointer shadow-sm active:scale-95"
          title="Inspect supporting signals, historical baselines, and model explainability"
        >
          <HelpCircle className="w-3 h-3 text-amber-400" />
          <span>Why This Insight?</span>
        </button>

        {/* 3. Plan Intervention Button */}
        <button
          onClick={() => onPlanIntervention(pattern)}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-[#C94A2A]/60 bg-[#C94A2A] text-white text-[8.5px] font-mono uppercase font-bold hover:bg-[#b03d20] transition-all cursor-pointer shadow-md active:scale-95"
          title="Formulate recommendation, simulate plan, and initiate 5-stage human approval workflow"
        >
          <Sparkles className="w-3 h-3" />
          <span>Plan Intervention</span>
        </button>
      </div>
    </div>
  );
};

export default SentinelAlertCard;
