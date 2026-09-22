import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Compass,
  FileSearch,
  Flame,
  HelpCircle,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';
import {
  advanceInterventionStage,
  createIntervention,
  listInterventions,
  updateIntervention,
  type InterventionRecord,
  type InterventionWorkflowStage,
  type UnifiedIntelligenceResult,
} from '../../services/api';

export type ModalTab = 'why_insight' | 'recommendation' | 'plan_compare' | 'approval_workflow' | 'outcome_review';

interface SentinelWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  pattern: UnifiedIntelligenceResult | null;
  initialTab?: ModalTab;
  onNavigateToInvestigation?: (firOrEntityId?: string) => void;
}

const STAGES: { key: InterventionWorkflowStage; label: string; hint: string }[] = [
  { key: 'draft', label: 'Draft', hint: 'Recommendation formulation' },
  { key: 'supervisor_review', label: 'Supervisor Review', hint: 'Review & resource sign-off' },
  { key: 'approved', label: 'Approved', hint: 'Awaiting field deployment' },
  { key: 'deployed', label: 'Deployed', hint: 'Active field operation' },
  { key: 'outcome_review', label: 'Outcome Review', hint: 'Post-deployment review' },
];

export const SentinelWorkflowModal: React.FC<SentinelWorkflowModalProps> = ({
  isOpen,
  onClose,
  pattern,
  initialTab = 'recommendation',
  onNavigateToInvestigation,
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>(initialTab);
  const [existingIntervention, setExistingIntervention] = useState<InterventionRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Form State for Recommendation formulation
  const [recTitle, setRecTitle] = useState('');
  const [recActionType, setRecActionType] = useState('patrol_surge');
  const [recArea, setRecArea] = useState('');
  const [recTimePeriod, setRecTimePeriod] = useState('');
  const [recReason, setRecReason] = useState('');
  const [recAssumptions, setRecAssumptions] = useState('');

  // Simulation parameters for Plan & Compare
  const [simShiftDuration, setSimShiftDuration] = useState(6); // hours
  const [simPatrolVehicles, setSimPatrolVehicles] = useState(3); // vehicles
  const [simPatrolFrequency, setSimPatrolFrequency] = useState(4); // passes per shift

  // Supervisor & Transition Notes
  const [transitionNotes, setTransitionNotes] = useState('');

  // Outcome Review Form State
  const [postCrimeCount, setPostCrimeCount] = useState<number | ''>('');
  const [patternPersisted, setPatternPersisted] = useState<string>('reduced');
  const [observedOutcome, setObservedOutcome] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');

  // Reset tab on open
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setActionError(null);
      setActionSuccess(null);
    }
  }, [isOpen, initialTab]);

  // Sync recommendation fields when pattern changes
  useEffect(() => {
    if (!pattern) return;

    const district = pattern.location?.district || 'District Wide';
    const stations = pattern.location?.stations || [];
    const areaStr = stations.length ? `${district} (Stations: ${stations.join(', ')})` : district;

    const c = pattern.change_from_baseline;
    const pct = c ? Math.round(c.change_percentage || 0) : 0;
    const baselineLabel = c?.baseline_window_days ? `${c.baseline_window_days}-day` : 'historical';
    const rec = pattern.recommended_action_input;

    setRecTitle(rec?.title || `Review night patrol allocation — ${pattern.pattern_type}`);
    setRecActionType(rec?.action_type || 'patrol_surge');
    setRecArea(areaStr);
    setRecTimePeriod(pattern.time_window ? `Next 14-30 days (based on ${pattern.time_window.replace(/_/g, ' ')})` : 'Next 14 days');
    setRecReason(
      pattern.explanation ||
        `Detected ${pattern.pattern_type} in ${district} with ${pct >= 0 ? '+' : ''}${pct}% deviation from the ${baselineLabel} baseline average.`
    );
    // No pre-filled assumptions — the officer must state their own, since we
    // have no real resource-availability data to assert.
    setRecAssumptions('');

    // Look up if an intervention is already created for this intelligence_id
    listInterventions({ intelligence_id: pattern.intelligence_id })
      .then((res) => {
        const found = res.results?.[0] || res.interventions?.[0];
        if (found) {
          setExistingIntervention(found);
          if (found.title) setRecTitle(found.title);
          if (found.reason) setRecReason(found.reason);
          if (found.relevant_time_period) setRecTimePeriod(found.relevant_time_period);
          if (found.assumptions) setRecAssumptions(found.assumptions);
          if (found.subsequent_crime_count !== undefined && found.subsequent_crime_count !== null) {
            setPostCrimeCount(found.subsequent_crime_count);
          }
          if (found.pattern_persisted) setPatternPersisted(found.pattern_persisted);
          if (found.observed_outcome) setObservedOutcome(found.observed_outcome);
          if (found.review_notes) setReviewNotes(found.review_notes);
        } else {
          setExistingIntervention(null);
        }
      })
      .catch(() => {
        setExistingIntervention(null);
      });
  }, [pattern]);

  if (!isOpen || !pattern) return null;

  // Planning heuristic only. Every number below is either (a) a real field
  // from the unified-intelligence result, or (b) an explicit function of the
  // officer's own slider inputs — never a placeholder masquerading as data.
  // No coverage telemetry or resource-availability feed exists, so the
  // "current deployment" column is reported as not instrumented.
  const hasRiskScore = Number.isFinite(pattern.risk_score);
  const predictedCrimes = pattern.forecast?.predicted_crime_count ?? null;
  const h3CellCount = pattern.affected_h3_cells?.length ?? 0;

  const simulatedCoverage = Math.min(98, Math.round(simPatrolVehicles * 8 + simPatrolFrequency * 4));
  const baselineExposure = hasRiskScore ? Math.round(pattern.risk_score * 100) : null;
  const simulatedExposure =
    baselineExposure === null
      ? null
      : Math.max(0, Math.round(baselineExposure * (1 - Math.min(0.85, simulatedCoverage / 100))));
  const estimatedPrevented =
    predictedCrimes === null || predictedCrimes <= 0
      ? null
      : Math.round(predictedCrimes * (simulatedCoverage / 100));

  // Current workflow stage
  const currentStage: InterventionWorkflowStage = existingIntervention?.workflow_stage || 'draft';
  const currentStageIndex = STAGES.findIndex((s) => s.key === currentStage);

  // Helper: Create Draft if not exists
  const ensureDraftIntervention = async (): Promise<InterventionRecord> => {
    if (existingIntervention) return existingIntervention;
    const res = await createIntervention({
      district: pattern.location?.district || 'Karnataka',
      intervention_type: recActionType,
      title: recTitle,
      description: `${recReason}\n\nAssumptions: ${recAssumptions}`,
      started_at: new Date().toISOString(),
      status: 'planned',
      workflow_stage: 'draft',
      intelligence_id: pattern.intelligence_id,
      pattern_type: pattern.pattern_type,
      affected_h3_cells: JSON.stringify(pattern.affected_h3_cells || []),
      relevant_time_period: recTimePeriod,
      reason: recReason,
      supporting_intelligence: JSON.stringify(pattern.supporting_signals || []),
      estimated_coverage: simulatedCoverage,
      assumptions: recAssumptions,
      simulation_data: JSON.stringify({
        current_coverage: null,
        proposed_coverage: simulatedCoverage,
        current_exposure: baselineExposure,
        proposed_exposure: simulatedExposure,
        predicted_crime_count: predictedCrimes,
        vehicles: simPatrolVehicles,
        frequency: simPatrolFrequency,
        label: 'Planning simulation — not a causal guarantee of crime reduction.',
      }),
    });
    setExistingIntervention(res);
    return res;
  };

  // Human Workflow Transition Handler
  const handleAdvanceStage = async (targetStage: InterventionWorkflowStage) => {
    setSubmitting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      let record = existingIntervention;
      if (!record) {
        record = await ensureDraftIntervention();
      }

      // If targetStage is supervisor_review and we just created draft, advance it
      const outcomeData =
        targetStage === 'completed'
          ? {
              subsequent_crime_count: postCrimeCount === '' ? undefined : Number(postCrimeCount),
              pattern_persisted: patternPersisted,
              observed_outcome: observedOutcome,
              review_notes: reviewNotes,
            }
          : undefined;

      const updated = await advanceInterventionStage(record.id, {
        target_stage: targetStage,
        notes: transitionNotes || undefined,
        outcome_data: outcomeData,
      });

      setExistingIntervention(updated);
      setTransitionNotes('');
      if (targetStage === 'completed') {
        setActionSuccess(
          currentStage === 'completed'
            ? 'Outcome debrief changes updated successfully.'
            : 'Intervention outcome finalized and successfully archived.'
        );
      } else {
        setActionSuccess(`Workflow stage successfully moved to "${STAGES.find((s) => s.key === targetStage)?.label}".`);
      }

      if (targetStage === 'outcome_review') {
        setActiveTab('outcome_review');
      }
    } catch (e: any) {
      setActionError(e?.message || 'Failed to update workflow stage.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    setSubmitting(true);
    setActionError(null);

    setActionSuccess(null);
    try {
      if (existingIntervention) {
        const updated = await updateIntervention(existingIntervention.id, {
          title: recTitle,
          reason: recReason,
          relevant_time_period: recTimePeriod,
          assumptions: recAssumptions,
          estimated_coverage: simulatedCoverage,
        });
        setExistingIntervention(updated);
        setActionSuccess('Intervention recommendation saved.');
      } else {
        await ensureDraftIntervention();
        setActionSuccess('Draft intervention recommendation created.');
      }
    } catch (e: any) {
      setActionError(e?.message || 'Failed to save draft.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInvestigateClick = () => {
    onClose();
    const firOrEntityId =
      pattern.related_fir_ids?.[0] ||
      pattern.related_entity_ids?.[0] ||
      pattern.location?.district;
    if (onNavigateToInvestigation) {
      onNavigateToInvestigation(firOrEntityId);
    } else {
      window.dispatchEvent(
        new CustomEvent('navigate-tab', {
          detail: { tab: 'investigation', targetId: firOrEntityId },
        })
      );
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-hidden">
      <div className="relative w-full max-w-4xl h-[90vh] max-h-[calc(100dvh-20px)] flex flex-col rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] shadow-2xl overflow-hidden select-none">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border-primary)] bg-[var(--bg-elevated)]/80 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center border border-[#C94A2A]/40 bg-[#C94A2A]/10 text-[#FF6B4A] shrink-0">
              <Sparkles className="w-3.5 h-3.5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xs sm:text-sm font-mono font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  Sentinel Action Workflow
                </h3>
                <span className="px-2 py-0.5 rounded text-[7px] font-mono uppercase font-bold border border-[#C94A2A]/50 bg-[#C94A2A]/20 text-[#FF6B4A]">
                  Human Oversight Active
                </span>
              </div>
              <p className="text-[8px] font-mono text-[var(--text-muted)] mt-0.5 truncate max-w-lg">
                Pattern: {pattern.pattern_type} · {pattern.location?.district}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg border border-transparent hover:border-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors cursor-pointer shrink-0 ml-2"
            title="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[var(--border-primary)] bg-[var(--bg-primary)]/40 px-3 overflow-x-auto custom-scrollbar shrink-0">
          {[
            { key: 'recommendation', label: '1. Recommendation', icon: Compass },
            { key: 'plan_compare', label: '2. Plan & Compare', icon: Sliders },
            { key: 'approval_workflow', label: '3. Approval Pipeline', icon: UserCheck },
            { key: 'outcome_review', label: '4. Outcome Review', icon: ShieldCheck },
            { key: 'why_insight', label: 'Why This Insight?', icon: HelpCircle },
          ].map((tab) => {
            const Icon = tab.icon;
            const isCurrent = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key as ModalTab);
                  setActionError(null);
                  setActionSuccess(null);
                }}
                className={`flex items-center gap-1.5 px-3 py-2 border-b-2 text-[8.5px] font-mono uppercase font-bold transition-all cursor-pointer shrink-0 ${
                  isCurrent
                    ? 'border-[#C94A2A] text-[#FF6B4A] bg-[var(--bg-secondary)]/50'
                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon className="w-3 h-3" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Global Banner: Workflow Status & Human Rule */}
        <div className="px-4 py-1.5 bg-[var(--bg-elevated)]/30 border-b border-[var(--border-primary)]/60 flex flex-wrap items-center justify-between gap-2 text-[7.5px] font-mono shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] uppercase">Current Stage:</span>
            <span className="px-2 py-0.2 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-300 font-bold uppercase">
              {STAGES.find((s) => s.key === currentStage)?.label || currentStage}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[var(--text-muted)] uppercase">
            <ShieldAlert className="w-2.5 h-2.5 text-[#C94A2A]" />
            Strict Human Gate: Operational deployment requires explicit commander authorization.
          </div>
        </div>

        {/* Body Content by Tab */}
        <div className="p-3.5 sm:p-4 flex-1 overflow-y-auto custom-scrollbar space-y-3 min-h-0">
          {actionSuccess && (
            <div className="p-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-[8.5px] font-mono flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{actionSuccess}</span>
              </div>
              <button onClick={() => setActionSuccess(null)} className="p-0.5 text-emerald-300 hover:text-white cursor-pointer shrink-0">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {actionError && (
            <div className="p-2 rounded-lg border border-[#C94A2A]/40 bg-[#C94A2A]/10 text-[#FF6B4A] text-[8.5px] font-mono flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{actionError}</span>
              </div>
              <button onClick={() => setActionError(null)} className="p-0.5 text-[#FF6B4A] hover:text-white cursor-pointer shrink-0">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}


          {/* ========================================================================= */}
          {/* TAB 1: INTERVENTION RECOMMENDATION FORMULATION                            */}
          {/* ========================================================================= */}
          {activeTab === 'recommendation' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl border border-blue-500/30 bg-blue-500/5">
                <span className="text-[8px] font-mono font-bold uppercase text-[#60a5fa] tracking-wider flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5" /> Synthesized Operational Recommendation
                </span>
                <p className="text-[9px] text-[var(--text-secondary)] mt-1">
                  Unified intelligence converted into a reviewable operational plan for sector field units.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Field 1: Action Title */}
                <div className="space-y-1">
                  <label className="text-[8px] font-mono uppercase font-bold text-[var(--text-muted)]">
                    Recommendation Title
                  </label>
                  <input
                    type="text"
                    value={recTitle}
                    onChange={(e) => setRecTitle(e.target.value)}
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10.5px] font-mono text-[var(--text-primary)] outline-none focus:border-[#C94A2A]"
                    placeholder="e.g. Review night patrol allocation"
                  />
                </div>

                {/* Field 2: Action Type */}
                <div className="space-y-1">
                  <label className="text-[8px] font-mono uppercase font-bold text-[var(--text-muted)]">
                    Intervention Type
                  </label>
                  <select
                    value={recActionType}
                    onChange={(e) => setRecActionType(e.target.value)}
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10.5px] font-mono text-[var(--text-primary)] outline-none focus:border-[#C94A2A]"
                  >
                    <option value="patrol_surge">Patrol Surge</option>
                    <option value="checkpoint">Targeted Checkpoints</option>
                    <option value="cctv_deployment">CCTV Corridor Deployment</option>
                    <option value="investigation">Targeted Investigation</option>
                    <option value="community_program">Community Awareness Drive</option>
                  </select>
                </div>

                {/* Field 3: Affected Area */}
                <div className="space-y-1">
                  <label className="text-[8px] font-mono uppercase font-bold text-[var(--text-muted)]">
                    Affected Area (Jurisdiction & Stations)
                  </label>
                  <input
                    type="text"
                    value={recArea}
                    onChange={(e) => setRecArea(e.target.value)}
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-mono text-[var(--text-primary)] outline-none focus:border-[#C94A2A]"
                  />
                </div>

                {/* Field 4: Relevant Time Period */}
                <div className="space-y-1">
                  <label className="text-[8px] font-mono uppercase font-bold text-[var(--text-muted)]">
                    Relevant Time Period
                  </label>
                  <input
                    type="text"
                    value={recTimePeriod}
                    onChange={(e) => setRecTimePeriod(e.target.value)}
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-mono text-[var(--text-primary)] outline-none focus:border-[#C94A2A]"
                    placeholder="e.g. Next 14 days (Night shifts 22:00-04:00)"
                  />
                </div>
              </div>

              {/* Field 5: Reason for Recommendation */}
              <div className="space-y-1">
                <label className="text-[8px] font-mono uppercase font-bold text-[var(--text-muted)]">
                  Reason for Recommendation
                </label>
                <textarea
                  value={recReason}
                  onChange={(e) => setRecReason(e.target.value)}
                  rows={2}
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-mono text-[var(--text-primary)] outline-none focus:border-[#C94A2A]"
                />
              </div>

              {/* Field 6: Supporting Intelligence Preview */}
              <div className="space-y-1.5">
                <label className="text-[8px] font-mono uppercase font-bold text-[var(--text-muted)]">
                  Supporting Intelligence Signals ({pattern.supporting_signals?.length || 0})
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {pattern.supporting_signals?.map((s, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)]/50 text-[8.5px] font-mono"
                    >
                      <div className="flex items-center justify-between text-[7.5px] uppercase font-bold text-[#D4820A]">
                        <span>{s.signal_type.replace(/_/g, ' ')}</span>
                        <span className="px-1 py-0.2 rounded border border-[#D4820A]/30">{s.status}</span>
                      </div>
                      <p className="text-[var(--text-secondary)] mt-1">{s.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Field 7: Assumptions */}
              <div className="space-y-1">
                <label className="text-[8px] font-mono uppercase font-bold text-[var(--text-muted)]">
                  Operational Assumptions
                </label>
                <textarea
                  value={recAssumptions}
                  onChange={(e) => setRecAssumptions(e.target.value)}
                  rows={2}
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-mono text-[var(--text-primary)] outline-none focus:border-[#C94A2A]"
                  placeholder="e.g. Assumes 2 dedicated patrol cars available across sectors"
                />
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-[var(--border-primary)]">
                <button
                  onClick={handleInvestigateClick}
                  className="inline-flex items-center gap-1.5 text-[8.5px] font-mono uppercase text-[#60a5fa] hover:underline cursor-pointer"
                >
                  <FileSearch className="w-3 h-3" />
                  Investigate linked FIRs & criminal entities in Investigation tab (Issue #250)
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveDraft}
                    disabled={submitting}
                    className="px-3 py-1.5 rounded-lg border border-[var(--border-primary)] text-[8.5px] font-mono uppercase font-bold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
                  >
                    Save Draft
                  </button>
                  <button
                    onClick={() => setActiveTab('plan_compare')}
                    className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg border border-[#C94A2A]/50 bg-[#C94A2A] text-white text-[8.5px] font-mono uppercase font-bold hover:bg-[#b03d20] transition-colors cursor-pointer"
                  >
                    <span>Proceed to Plan & Compare</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: SIMPLE PLAN & COMPARE SIMULATION                                   */}
          {/* ========================================================================= */}
          {activeTab === 'plan_compare' && (
            <div className="space-y-4">
              {/* Mandatory Callout Banner */}
              <div className="p-3 rounded-xl border border-amber-500/50 bg-amber-500/15 text-amber-200 shadow-md">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-mono font-black uppercase tracking-wider block">
                      Planning simulation — not a causal guarantee of crime reduction.
                    </span>
                    <p className="text-[8.5px] text-amber-300/90 mt-0.5 leading-relaxed">
                      Estimates are derived from historical spatio-temporal crime density and patrol frequency simulation models. They serve as situational planning aids and do not imply guaranteed deterministic deterrence.
                    </p>
                  </div>
                </div>
              </div>

              {/* Simulation Controls */}
              <div className="p-3.5 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-elevated)]/40 space-y-3">
                <span className="text-[8px] font-mono uppercase font-bold text-[var(--text-muted)] tracking-wider block">
                  Simulation Parameters (Adjust to test operational scenarios)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <div className="flex justify-between text-[8px] font-mono mb-1">
                      <span className="text-[var(--text-muted)]">Patrol Vehicles:</span>
                      <strong className="text-[var(--text-primary)]">{simPatrolVehicles} units</strong>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={6}
                      value={simPatrolVehicles}
                      onChange={(e) => setSimPatrolVehicles(Number(e.target.value))}
                      className="w-full accent-[#C94A2A] cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[8px] font-mono mb-1">
                      <span className="text-[var(--text-muted)]">Shift Coverage:</span>
                      <strong className="text-[var(--text-primary)]">{simShiftDuration} hrs/day</strong>
                    </div>
                    <input
                      type="range"
                      min={4}
                      max={12}
                      step={2}
                      value={simShiftDuration}
                      onChange={(e) => setSimShiftDuration(Number(e.target.value))}
                      className="w-full accent-[#C94A2A] cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[8px] font-mono mb-1">
                      <span className="text-[var(--text-muted)]">Patrol Passes:</span>
                      <strong className="text-[var(--text-primary)]">{simPatrolFrequency} passes/night</strong>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={8}
                      value={simPatrolFrequency}
                      onChange={(e) => setSimPatrolFrequency(Number(e.target.value))}
                      className="w-full accent-[#C94A2A] cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Side-by-Side Comparison Table: Current Deployment VS Proposed Intervention */}
              <div className="rounded-xl border border-[var(--border-primary)] overflow-hidden">
                <div className="grid grid-cols-3 bg-[var(--bg-elevated)]/80 text-[8.5px] font-mono uppercase font-bold p-2.5 border-b border-[var(--border-primary)]">
                  <div>Metric Dimension</div>
                  <div className="text-amber-400">Current Deployment</div>
                  <div className="text-emerald-400">Proposed Intervention (Simulated)</div>
                </div>

                <div className="px-2.5 py-1.5 bg-[var(--bg-primary)]/40 border-b border-[var(--border-primary)]/50 text-[7px] font-mono text-[var(--text-muted)]">
                  No patrol-coverage or resource telemetry is available, so the current column is reported as not instrumented. Proposed figures are transparent planning heuristics computed from your slider inputs.
                </div>

                <div className="divide-y divide-[var(--border-primary)]/50 bg-[var(--bg-secondary)]/40 text-[9px] font-mono">
                  {/* Row 1: Coverage */}
                  <div className="grid grid-cols-3 p-2.5 items-center">
                    <span className="text-[var(--text-primary)] font-semibold">Hotspot Area Coverage</span>
                    <span className="text-[var(--text-muted)]">Not instrumented</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      {simulatedCoverage}% heuristic estimate
                      <span className="text-[7.5px] px-1 py-0.2 rounded bg-emerald-500/20">simulated</span>
                    </span>
                  </div>

                  {/* Row 2: Exposure Index */}
                  <div className="grid grid-cols-3 p-2.5 items-center">
                    <span className="text-[var(--text-primary)] font-semibold">Risk Exposure Index</span>
                    <span className="text-rose-400 font-bold">
                      {baselineExposure !== null ? `${baselineExposure}/100 (baseline risk score)` : 'No risk score available'}
                    </span>
                    <span className="text-emerald-400 font-bold">
                      {simulatedExposure !== null ? `${simulatedExposure}/100 (heuristic estimate)` : 'Insufficient data'}
                    </span>
                  </div>

                  {/* Row 3: Resource Requirements */}
                  <div className="grid grid-cols-3 p-2.5 items-center">
                    <span className="text-[var(--text-primary)] font-semibold">Resource Commitment</span>
                    <span className="text-[var(--text-muted)]">Not recorded</span>
                    <span className="text-[var(--text-primary)] font-semibold">
                      {simPatrolVehicles} vehicles · {simPatrolVehicles * 2} officers ({simShiftDuration}h window)
                    </span>
                  </div>

                  {/* Row 4: Potential Prevention */}
                  <div className="grid grid-cols-3 p-2.5 items-center">
                    <span className="text-[var(--text-primary)] font-semibold">Simulated Suppression Aid</span>
                    <span className="text-[var(--text-muted)]">Baseline trend unchecked</span>
                    <span className="text-emerald-400 font-bold">
                      {estimatedPrevented !== null
                        ? `~${estimatedPrevented} potential incidents deterred`
                        : 'Forecast unavailable'}
                    </span>
                  </div>

                  {/* Row 5: H3 Hex Coverage */}
                  <div className="grid grid-cols-3 p-2.5 items-center">
                    <span className="text-[var(--text-primary)] font-semibold">Geospatial Hex Spread</span>
                    <span className="text-[var(--text-muted)]">
                      {h3CellCount > 0 ? `${h3CellCount} cells monitored` : 'No hex cells mapped'}
                    </span>
                    <span className="text-emerald-400 font-bold">
                      {h3CellCount > 0 ? `${h3CellCount} of ${h3CellCount} cells enveloped` : 'No hex cells mapped'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Navigation to Approval Workflow */}
              <div className="flex items-center justify-between pt-2 border-t border-[var(--border-primary)]">
                <button
                  onClick={() => setActiveTab('recommendation')}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border-primary)] text-[8.5px] font-mono uppercase text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                >
                  Back to Recommendation
                </button>
                <button
                  onClick={() => setActiveTab('approval_workflow')}
                  className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg border border-[#C94A2A]/50 bg-[#C94A2A] text-white text-[8.5px] font-mono uppercase font-bold hover:bg-[#b03d20] transition-colors cursor-pointer"
                >
                  <span>Proceed to Approval Workflow</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: HUMAN APPROVAL WORKFLOW PIPELINE                                   */}
          {/* ========================================================================= */}
          {activeTab === 'approval_workflow' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-elevated)]/40">
                <span className="text-[8px] font-mono uppercase font-bold text-[var(--text-muted)] tracking-wider block mb-2">
                  5-Stage Human Oversight Progression Pipeline
                </span>

                {/* Visual Stepper */}
                <div className="grid grid-cols-5 gap-2">
                  {STAGES.map((st, idx) => {
                    const isPassed = idx < currentStageIndex;
                    const isCurrent = idx === currentStageIndex;
                    return (
                      <div
                        key={st.key}
                        className={`p-2 rounded-lg border text-center transition-all ${
                          isCurrent
                            ? 'border-[#C94A2A] bg-[#C94A2A]/15 text-[#FF6B4A]'
                            : isPassed
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                            : 'border-[var(--border-primary)] bg-[var(--bg-primary)]/40 text-[var(--text-muted)]'
                        }`}
                      >
                        <div className="text-[7px] font-mono uppercase opacity-75">Stage {idx + 1}</div>
                        <div className="text-[9.5px] font-mono font-bold mt-0.5">{st.label}</div>
                        <div className="text-[6.5px] font-mono text-[var(--text-muted)] mt-0.5 truncate">
                          {st.hint}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Stage Specific Controls */}
              <div className="p-4 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]/70 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono uppercase font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-[#C94A2A]" /> Stage Action: {STAGES[currentStageIndex]?.label}
                  </span>
                  <span className="text-[7.5px] font-mono text-[var(--text-muted)]">
                    Target Status: {existingIntervention?.status || 'planned'}
                  </span>
                </div>

                {/* STAGE 1: DRAFT */}
                {currentStage === 'draft' && (
                  <div className="space-y-2.5">
                    <p className="text-[8.5px] text-[var(--text-secondary)]">
                      The intervention is in draft mode. Officers can review the recommendation, tune parameters in Plan & Compare, and submit the proposal for formal supervisor review.
                    </p>
                    <div className="space-y-1">
                      <label className="text-[7.5px] font-mono uppercase text-[var(--text-muted)]">
                        Officer Submission Remarks
                      </label>
                      <input
                        type="text"
                        value={transitionNotes}
                        onChange={(e) => setTransitionNotes(e.target.value)}
                        placeholder="e.g. Submitting night patrol allocation plan for KR Puram hotspot."
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-3 py-1.5 text-[9.5px] font-mono text-[var(--text-primary)] outline-none"
                      />
                    </div>
                    <button
                      onClick={() => handleAdvanceStage('supervisor_review')}
                      disabled={submitting}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-amber-500/50 bg-amber-500/20 text-amber-300 font-mono text-[9px] uppercase font-bold hover:bg-amber-500/30 transition-colors cursor-pointer"
                    >
                      <Send className="w-3 h-3" />
                      Submit for Supervisor Review
                    </button>
                  </div>
                )}

                {/* STAGE 2: SUPERVISOR REVIEW */}
                {currentStage === 'supervisor_review' && (
                  <div className="space-y-2.5">
                    <p className="text-[8.5px] text-[var(--text-secondary)]">
                      A supervisor or station commander must examine the plan, verifying squad allocation and operational feasibility before approving.
                    </p>
                    <div className="space-y-1">
                      <label className="text-[7.5px] font-mono uppercase text-[var(--text-muted)]">
                        Supervisor Review Notes / Authorization
                      </label>
                      <input
                        type="text"
                        value={transitionNotes}
                        onChange={(e) => setTransitionNotes(e.target.value)}
                        placeholder="e.g. Patrol assets approved; coordination with Traffic Police confirmed."
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-3 py-1.5 text-[9.5px] font-mono text-[var(--text-primary)] outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAdvanceStage('approved')}
                        disabled={submitting}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-emerald-500/50 bg-emerald-500/20 text-emerald-300 font-mono text-[9px] uppercase font-bold hover:bg-emerald-500/30 transition-colors cursor-pointer"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Approve Recommendation
                      </button>
                      <button
                        onClick={() => handleAdvanceStage('draft')}
                        disabled={submitting}
                        className="px-3 py-2 rounded-lg border border-[var(--border-primary)] text-[9px] font-mono uppercase text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                      >
                        Return to Draft for Revision
                      </button>
                    </div>
                  </div>
                )}

                {/* STAGE 3: APPROVED */}
                {currentStage === 'approved' && (
                  <div className="space-y-2.5">
                    <div className="p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 text-[8.5px] font-mono text-emerald-300">
                      Recommendation has been approved by supervisor. It is staged and awaiting human operational deployment orders.
                    </div>
                    {existingIntervention?.supervisor_notes && (
                      <p className="text-[8px] font-mono text-[var(--text-muted)]">
                        Supervisor Notes: {existingIntervention.supervisor_notes}
                      </p>
                    )}
                    <div className="space-y-1">
                      <label className="text-[7.5px] font-mono uppercase text-[var(--text-muted)]">
                        Field Deployment Order Remarks
                      </label>
                      <input
                        type="text"
                        value={transitionNotes}
                        onChange={(e) => setTransitionNotes(e.target.value)}
                        placeholder="e.g. Sector squads deployed as of 22:00."
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-3 py-1.5 text-[9.5px] font-mono text-[var(--text-primary)] outline-none"
                      />
                    </div>
                    <button
                      onClick={() => handleAdvanceStage('deployed')}
                      disabled={submitting}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#C94A2A]/50 bg-[#C94A2A] text-white font-mono text-[9px] uppercase font-bold hover:bg-[#b03d20] transition-colors cursor-pointer shadow-md"
                    >
                      <Flame className="w-3 h-3" />
                      Authorize & Deploy Operation (Human Action)
                    </button>
                  </div>
                )}

                {/* STAGE 4: DEPLOYED */}
                {currentStage === 'deployed' && (
                  <div className="space-y-2.5">
                    <div className="p-2.5 rounded-lg border border-[#C94A2A]/40 bg-[#C94A2A]/10 text-[8.5px] font-mono text-[#FF6B4A]">
                      Operation is currently DEPLOYED in the field. Real-time patrol monitoring active.
                    </div>
                    <p className="text-[8.5px] text-[var(--text-secondary)]">
                      When the tactical operation window concludes, proceed to post-deployment Outcome Review.
                    </p>
                    <button
                      onClick={() => handleAdvanceStage('outcome_review')}
                      disabled={submitting}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-purple-500/50 bg-purple-500/20 text-purple-300 font-mono text-[9px] uppercase font-bold hover:bg-purple-500/30 transition-colors cursor-pointer"
                    >
                      <ShieldCheck className="w-3 h-3" />
                      Initiate Post-Deployment Outcome Review
                    </button>
                  </div>
                )}

                {/* STAGE 5: OUTCOME REVIEW */}
                {currentStage === 'completed' ? (
                  <div className="space-y-2.5">
                    <div className="p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-[8.5px] font-mono text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Lifecycle Completed: Outcome debrief recorded & archived.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setActiveTab('outcome_review');
                          setActionError(null);
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-emerald-500/50 bg-emerald-500/20 text-emerald-300 font-mono text-[8.5px] uppercase font-bold hover:bg-emerald-500/30 transition-colors cursor-pointer"
                      >
                        <ShieldCheck className="w-3 h-3" />
                        View / Edit Outcome Debrief
                      </button>
                      <button
                        onClick={() => handleAdvanceStage('outcome_review')}
                        disabled={submitting}
                        className="px-3 py-1.5 rounded-lg border border-[var(--border-primary)] text-[8.5px] font-mono uppercase text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                      >
                        Re-open Review Stage
                      </button>
                    </div>
                  </div>
                ) : currentStage === 'outcome_review' ? (
                  <div className="space-y-2.5">
                    <p className="text-[8.5px] text-[var(--text-secondary)]">
                      Operation completed. Navigate to the Outcome Review tab to record observed crime counts, pattern persistence, and debriefing notes.
                    </p>
                    <button
                      onClick={() => {
                        setActiveTab('outcome_review');
                        setActionError(null);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-emerald-500/50 bg-emerald-500/20 text-emerald-300 font-mono text-[9px] uppercase font-bold hover:bg-emerald-500/30 transition-colors cursor-pointer"
                    >
                      Go to Outcome Review Form
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: OUTCOME REVIEW POST-DEPLOYMENT RECORDING                           */}
          {/* ========================================================================= */}
          {activeTab === 'outcome_review' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl border border-purple-500/30 bg-purple-500/5">
                <span className="text-[8px] font-mono font-bold uppercase text-purple-300 tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" /> Post-Deployment Outcome Debrief
                </span>
                <p className="text-[9px] text-[var(--text-secondary)] mt-1">
                  Record actual field results, subsequent crime incidence, and evaluate if the detected pattern subsided.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Subsequent Crime Count */}
                <div className="space-y-1">
                  <label className="text-[8px] font-mono uppercase font-bold text-[var(--text-muted)]">
                    Subsequent Crime Count in Window
                  </label>
                  <input
                    type="number"
                    value={postCrimeCount}
                    onChange={(e) => setPostCrimeCount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10.5px] font-mono text-[var(--text-primary)] outline-none focus:border-[#C94A2A]"
                    placeholder="e.g. 3 incidents observed"
                  />
                </div>

                {/* 2. Whether Pattern Persisted */}
                <div className="space-y-1">
                  <label className="text-[8px] font-mono uppercase font-bold text-[var(--text-muted)]">
                    Whether Pattern Persisted
                  </label>
                  <select
                    value={patternPersisted}
                    onChange={(e) => setPatternPersisted(e.target.value)}
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10.5px] font-mono text-[var(--text-primary)] outline-none focus:border-[#C94A2A]"
                  >
                    <option value="resolved">Resolved — Crime activity ceased</option>
                    <option value="reduced">Reduced — Substantial decrease observed</option>
                    <option value="persisted">Persisted — Pattern remains active</option>
                    <option value="displaced">Displaced — Activity shifted to neighboring sectors</option>
                  </select>
                </div>
              </div>

              {/* 3. Observed Outcome */}
              <div className="space-y-1">
                <label className="text-[8px] font-mono uppercase font-bold text-[var(--text-muted)]">
                  Observed Outcome Summary
                </label>
                <textarea
                  value={observedOutcome}
                  onChange={(e) => setObservedOutcome(e.target.value)}
                  rows={2}
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-mono text-[var(--text-primary)] outline-none focus:border-[#C94A2A]"
                  placeholder="e.g. Crime dropped by 45% vs baseline; vehicle theft gang deterred from targeted parking areas."
                />
              </div>

              {/* 4. Review Notes / Debrief */}
              <div className="space-y-1">
                <label className="text-[8px] font-mono uppercase font-bold text-[var(--text-muted)]">
                  Officer Review & Debriefing Notes
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-mono text-[var(--text-primary)] outline-none focus:border-[#C94A2A]"
                  placeholder="e.g. Field teams noted high visibility near the transit station was key. Suggest continuing random weekend checks."
                />
              </div>

              {/* Pre-deployment warning if stage is draft, supervisor_review, or approved */}
              {['draft', 'supervisor_review', 'approved'].includes(currentStage) && (
                <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-[8.5px] font-mono">
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-amber-200">
                      Intervention is currently in <strong>{STAGES.find((s) => s.key === currentStage)?.label || currentStage}</strong> stage. Field deployment must occur before recording final outcome results.
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveTab('approval_workflow')}
                    className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[8px] uppercase font-bold shrink-0 cursor-pointer"
                  >
                    Go to Approval Pipeline
                  </button>
                </div>
              )}

              {/* Save & Finalize */}
              <div className="flex items-center justify-between pt-2 border-t border-[var(--border-primary)]">
                <span className="text-[7.5px] font-mono text-[var(--text-muted)] uppercase">
                  Status: {currentStage === 'completed' ? 'Completed & Archived' : 'Ready to finalize'}
                </span>
                <button
                  onClick={() => handleAdvanceStage('completed')}
                  disabled={submitting || ['draft', 'supervisor_review', 'approved'].includes(currentStage)}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border font-mono text-[9px] uppercase font-bold transition-colors cursor-pointer ${
                    ['draft', 'supervisor_review', 'approved'].includes(currentStage)
                      ? 'border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-muted)] opacity-50 cursor-not-allowed'
                      : 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {currentStage === 'completed' ? 'Update & Save Outcome Review' : 'Finalize & Archive Intervention'}
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: WHY THIS INSIGHT? (EXPLAINABILITY)                                 */}
          {/* ========================================================================= */}
          {activeTab === 'why_insight' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5">
                <span className="text-[8px] font-mono font-bold uppercase text-amber-300 tracking-wider flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5" /> Multi-Signal Explainability Report
                </span>
                <p className="text-[9px] text-[var(--text-secondary)] mt-1">
                  Why SAKSHA flagged this pattern: baseline deviation, concurring detection signals, and geographic concentration.
                </p>
              </div>

              {/* Baseline Comparison Details */}
              <div className="p-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-elevated)]/40">
                <span className="text-[8px] font-mono uppercase font-bold text-[var(--text-muted)] tracking-wider block mb-2">
                  Historical Baseline Comparison
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[9px] font-mono">
                  <div className="p-2 rounded bg-[var(--bg-primary)]/50 border border-[var(--border-primary)]">
                    <span className="text-[7px] text-[var(--text-muted)] block uppercase">Baseline Period</span>
                    <strong className="text-[var(--text-primary)]">
                      {pattern.change_from_baseline?.baseline_window_days != null
                        ? `${pattern.change_from_baseline.baseline_window_days} days lookback`
                        : 'Not specified'}
                    </strong>
                  </div>
                  <div className="p-2 rounded bg-[var(--bg-primary)]/50 border border-[var(--border-primary)]">
                    <span className="text-[7px] text-[var(--text-muted)] block uppercase">Expected (Normalized)</span>
                    <strong className="text-[var(--text-primary)]">
                      {pattern.change_from_baseline?.baseline_count?.toFixed(1) || 0} incidents
                    </strong>
                  </div>
                  <div className="p-2 rounded bg-[var(--bg-primary)]/50 border border-[var(--border-primary)]">
                    <span className="text-[7px] text-[var(--text-muted)] block uppercase">Current Observed</span>
                    <strong className="text-rose-400 font-bold">
                      {pattern.change_from_baseline?.current_count || 0} incidents
                    </strong>
                  </div>
                  <div className="p-2 rounded bg-[var(--bg-primary)]/50 border border-[var(--border-primary)]">
                    <span className="text-[7px] text-[var(--text-muted)] block uppercase">Net Change</span>
                    <strong className="text-rose-400 font-bold">
                      {(pattern.change_from_baseline?.change_percentage || 0) >= 0 ? '+' : ''}
                      {Math.round(pattern.change_from_baseline?.change_percentage || 0)}%
                    </strong>
                  </div>
                </div>
              </div>

              {/* Corroborating Signals Breakdown */}
              <div className="space-y-2">
                <span className="text-[8px] font-mono uppercase font-bold text-[var(--text-muted)] tracking-wider block">
                  Corroborating Signals ({pattern.supporting_signals?.length || 0})
                </span>
                <div className="space-y-2">
                  {pattern.supporting_signals?.map((sig, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)]/40 flex items-start gap-2.5 text-[9px] font-mono"
                    >
                      <span className="w-6 h-6 rounded-md flex items-center justify-center border border-[#D4820A]/40 bg-[#D4820A]/10 text-[#D4820A] shrink-0 mt-0.5">
                        <Activity className="w-3 h-3" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[var(--text-primary)] uppercase">
                            {sig.signal_type.replace(/_/g, ' ')}
                          </span>
                          <span className="px-1.5 py-0.2 rounded border border-[#0E9E78]/40 bg-[#0E9E78]/10 text-emerald-400 text-[7px] font-bold">
                            {sig.status}
                          </span>
                        </div>
                        <p className="text-[var(--text-secondary)] mt-1">{sig.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Linked FIRs & Quick Investigation Link */}
              <div className="p-3 rounded-xl border border-[#1E6FD9]/30 bg-[#1E6FD9]/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[8px] font-mono uppercase font-bold text-[#60a5fa] block">
                    Linked Cases & Investigation Deep-Dive (Issue #250)
                  </span>
                  <p className="text-[8.5px] text-[var(--text-secondary)] mt-0.5">
                    {pattern.related_fir_ids?.length || 0} related FIRs found in this cluster:{' '}
                    <span className="font-mono text-[var(--text-primary)]">
                      {(pattern.related_fir_ids || []).slice(0, 4).join(', ') || 'None explicit'}
                    </span>
                  </p>
                </div>
                <button
                  onClick={handleInvestigateClick}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1E6FD9]/40 bg-[#1E6FD9]/20 text-[#60a5fa] text-[8.5px] font-mono uppercase font-bold hover:bg-[#1E6FD9]/30 transition-colors cursor-pointer shrink-0"
                >
                  <FileSearch className="w-3 h-3" />
                  Launch Investigation
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-2.5 border-t border-[var(--border-primary)] bg-[var(--bg-elevated)]/60 flex items-center justify-between shrink-0">
          <span className="text-[7px] font-mono text-[var(--text-muted)] uppercase">
            Model: {pattern.model_name} ({pattern.ml_status} v{pattern.model_version}) · {pattern.data_provenance} Provenance
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-[var(--border-primary)] text-[8.5px] font-mono uppercase text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SentinelWorkflowModal;
