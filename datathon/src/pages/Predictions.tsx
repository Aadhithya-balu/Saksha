import React, { useEffect, useState } from 'react';
import { useRBAC } from '../hooks/useRBAC';
import ForecastChart from '../components/charts/ForecastChart';
import CorrelationChart from '../components/charts/CorrelationChart';
import WeatherCorrelationChart from '../components/charts/WeatherCorrelationChart';
import IntelligenceStatusBadges from '../components/ui/IntelligenceStatusBadges';
import { Cpu, RefreshCw, ShieldAlert, Sparkles, Sun, CloudRain, Wind, Snowflake, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import { getAnomalies, getRiskScores, getModelInfo, getSeasonBreakdown, getEmergingTrends, trainRiskModels, type AnomalyRecord, type RiskScoresResponse, type ModelInfo, type SeasonData, type EmergingTypology } from '../services/api';
import { getIntelligenceStatus, getPredictionLabel, getConfidenceLabel } from '../services/intelligenceStatus';
import { PageSkeleton } from '../components/ui/Skeleton';
import { useUserScope } from '../hooks/useUserScope';

const SEASON_ICONS: Record<string, React.ReactNode> = {
  Summer: <Sun className="w-4 h-4 text-amber-400" />,
  Monsoon: <CloudRain className="w-4 h-4 text-blue-400" />,
  'Post-Monsoon': <Wind className="w-4 h-4 text-purple-400" />,
  Winter: <Snowflake className="w-4 h-4 text-cyan-400" />,
};

const SEASON_COLORS: Record<string, string> = {
  Summer: 'bg-amber-500/20 border-amber-500/30 text-amber-400',
  Monsoon: 'bg-blue-500/20 border-blue-500/30 text-blue-400',
  'Post-Monsoon': 'bg-purple-500/20 border-purple-500/30 text-purple-400',
  Winter: 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400',
};

const TREND_META: Record<EmergingTypology['direction'], { icon: React.ReactNode; cls: string }> = {
  increasing: { icon: <TrendingUp className="w-3.5 h-3.5" />, cls: 'bg-[#C94A2A]/10 border-[#C94A2A]/30 text-[#C94A2A]' },
  decreasing: { icon: <TrendingDown className="w-3.5 h-3.5" />, cls: 'bg-[#0E9E78]/10 border-[#0E9E78]/30 text-[#0E9E78]' },
  stable: { icon: <Minus className="w-3.5 h-3.5" />, cls: 'bg-blue-500/10 border-blue-500/30 text-blue-400' },
};

export const Predictions: React.FC = () => {
  const { isAdmin } = useRBAC();
  const { district: scopeDistrict, canSelectDistrict } = useUserScope();
  const [riskScores, setRiskScores] = useState<RiskScoresResponse | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalyRecord[]>([]);
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [seasons, setSeasons] = useState<SeasonData[]>([]);
  const [typologies, setTypologies] = useState<EmergingTypology[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrainState, setRetrainState] = useState<'idle' | 'running' | 'ok' | 'failed'>('idle');
  const [sectionsLoaded, setSectionsLoaded] = useState({ risk: false, seasons: false, trends: false });

  // Sub-service partial error tracking
  const [riskScoresError, setRiskScoresError] = useState<string | null>(null);
  const [seasonsError, setSeasonsError] = useState<string | null>(null);
  const [typologiesError, setTypologiesError] = useState<string | null>(null);

  const fetchPredictions = React.useCallback(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    setRiskScoresError(null);
    setSeasonsError(null);
    setTypologiesError(null);

    Promise.allSettled([
      getRiskScores(),
      getAnomalies(),
      getModelInfo(),
      getSeasonBreakdown(),
      getEmergingTrends(),
    ]).then(([riskRes, anomalyRes, modelRes, seasonRes, typologyRes]) => {
      if (!isMounted) return;

      if (riskRes.status === 'fulfilled') {
        setRiskScores(riskRes.value);
      } else {
        setRiskScores(null);
        setRiskScoresError('District risk prediction model unavailable');
      }

      if (anomalyRes.status === 'fulfilled') {
        setAnomalies(anomalyRes.value?.anomalies || []);
      } else {
        setAnomalies([]);
      }

      if (modelRes.status === 'fulfilled') {
        setModelInfo(modelRes.value);
      } else {
        setModelInfo(null);
      }

      if (seasonRes.status === 'fulfilled') {
        setSeasons(seasonRes.value?.seasons || []);
      } else {
        setSeasons([]);
        setSeasonsError('Seasonal crime intelligence service unavailable');
      }

      if (typologyRes.status === 'fulfilled') {
        setTypologies(typologyRes.value || []);
      } else {
        setTypologies([]);
        setTypologiesError('Emerging crime typologies service unavailable');
      }

      // Only show top-level blocking error if all primary predictive sources failed
      if (riskRes.status === 'rejected' && seasonRes.status === 'rejected' && typologyRes.status === 'rejected') {
        setError('Predictive intelligence models currently unreachable. Please retry.');
      }
    }).finally(() => {
      if (isMounted) setLoading(false);
    });

    // 1. Load risk scores + anomalies (primary data) — modelInfo is embedded in risk response
    void getRiskScores()
      .then((riskResponse) => {
        if (!isMounted) return;
        setRiskScores(riskResponse);
        setSectionsLoaded(prev => ({ ...prev, risk: true }));
        // Derive modelInfo from the risk response instead of a separate /model-info call
        if (riskResponse.prediction_mode || riskResponse.model_version) {
          setModelInfo(prev => prev ?? {
            model_name: 'SAKSHA District Risk & Forecast',
            risk_model_loaded: riskResponse.risk_model_loaded ?? false,
            forecast_model_loaded: false,
            version: riskResponse.model_version ?? 'unknown',
            risk_algorithm: 'RandomForest',
            forecast_algorithm: 'XGBoost',
            trained_on: null,
            training_rows: 0,
            risk_metrics: {},
            forecast_metrics: {},
          });
        }
      })
      .catch(() => {
        if (isMounted) {
          setError('Failed to load prediction data. Please try again.');
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    // 2. Load anomalies in parallel (fast endpoint)
    void getAnomalies()
      .then((anomalyResponse) => {
        if (isMounted) setAnomalies(anomalyResponse.anomalies);
      })
      .catch(() => undefined);

    // 3. Load seasons (independent, progressive)
    void getSeasonBreakdown()
      .then((seasonResponse) => {
        if (isMounted) {
          setSeasons(seasonResponse.seasons);
          setSectionsLoaded(prev => ({ ...prev, seasons: true }));
        }
      })
      .catch(() => {
        if (isMounted) setSectionsLoaded(prev => ({ ...prev, seasons: true }));
      });

    // 4. Load emerging trends (non-blocking)
    void getEmergingTrends()
      .then((typologyResponse) => {
        if (isMounted) {
          setTypologies(typologyResponse);
          setSectionsLoaded(prev => ({ ...prev, trends: true }));
        }
      })
      .catch(() => {
        if (isMounted) setSectionsLoaded(prev => ({ ...prev, trends: true }));
      });

    // 5. Load model info separately only if risk scores didn't provide it
    void getModelInfo()
      .then((modelResponse) => {
        if (isMounted) setModelInfo(modelResponse);
      })
      .catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    return fetchPredictions();
  }, [fetchPredictions]);

  const predictionRows = riskScores?.grid_predictions ?? [];

  // Intelligence status derived ONLY from backend metadata (issue 9 §3/§11):
  // a numeric risk score never implies live ML by itself.
  const statusBadges = getIntelligenceStatus({
    predictionMode: riskScores?.prediction_mode,
    modelLoaded: modelInfo ? modelInfo.risk_model_loaded : undefined,
    dataProvenance: riskScores?.data_provenance,
  });
  const predictionLabel = getPredictionLabel({
    predictionMode: riskScores?.prediction_mode,
    dataProvenance: riskScores?.data_provenance,
    modelVersion: riskScores?.model_version ?? modelInfo?.version ?? null,
  });
  const hasPredictionStatus = Boolean(riskScores?.prediction_mode);

  const handleRetrain = async () => {
    setRetrainState('running');
    try {
      await trainRiskModels();
      setRetrainState('ok');
      // Refresh only risk scores (modelInfo is derived from it)
      const riskResponse = await getRiskScores();
      setRiskScores(riskResponse);
    } catch {
      setRetrainState('failed');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-1 md:p-3 select-none bg-[var(--bg-primary)]">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-[var(--border-muted)] pb-3">
          <div>
            <h2 className="text-md font-mono font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
              <Cpu className="w-5 h-5 text-[#0E9E78] animate-pulse" />
              AI Crime Predictive Intelligence
            </h2>
            <p className="text-[9.5px] font-mono text-[var(--text-muted)] mt-0.5">
              Loading predictive models...
            </p>
          </div>
        </div>
        <PageSkeleton />
      </div>
    );
  }

  if (error && !riskScores && seasons.length === 0) {
    return (
      <div className="flex flex-col gap-6 p-1 md:p-3 select-none bg-[var(--bg-primary)]">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-[var(--border-muted)] pb-3">
          <div>
            <h2 className="text-md font-mono font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
              <Cpu className="w-5 h-5 text-[#0E9E78]" />
              AI Crime Predictive Intelligence
            </h2>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-[var(--accent-coral-subtle)] border border-[var(--accent-coral)]/20 flex items-center justify-center mx-auto">
              <Cpu className="w-6 h-6 text-[var(--accent-coral)]" />
            </div>
            <p className="text-sm text-[var(--text-secondary)]">{error}</p>
            <button onClick={() => fetchPredictions()}
              className="px-3 py-1.5 text-[10px] font-mono uppercase bg-[var(--accent-blue)]/10 hover:bg-[var(--accent-blue)]/20 text-[var(--accent-blue)] border border-[var(--accent-blue)]/30 rounded-btn transition-colors cursor-pointer">
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-1 md:p-3 select-none bg-[var(--bg-primary)]">
      
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-[var(--border-muted)] pb-3">
        <div>
          <h2 className="text-md font-mono font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
            <Cpu className="w-5 h-5 text-[#0E9E78] animate-pulse" />
            AI Crime Predictive Intelligence
          </h2>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {hasPredictionStatus ? (
              <IntelligenceStatusBadges badges={statusBadges} withInfo={false} />
            ) : (
              <IntelligenceStatusBadges
                badges={{ kind: 'UNKNOWN', label: 'STATUS UNAVAILABLE', tooltip: 'The backend did not report prediction status for this result.', tone: 'muted', priority: 7 }}
              />
            )}
            <span className="text-[9.5px] font-mono text-[var(--text-muted)]">
              {predictionLabel}
              {riskScores?.data_provenance ? ` · Source: ${riskScores.data_provenance === 'LIVE_DB' ? 'SAKSHA Crime Records' : riskScores.data_provenance}` : ''}
            </span>
          </div>
        </div>

        {isAdmin && (
        <button
          onClick={handleRetrain}
          disabled={retrainState === 'running'}
          title="Retrains the district risk models from live records (admin only)."
          className={`px-2.5 py-1.5 border font-mono text-[9px] uppercase rounded-btn transition-colors flex items-center gap-1.5 ${
            retrainState === 'running'
              ? 'bg-[#0E9E78]/5 border-[#0e9e78]/20 text-[#0E9E78]/60 cursor-wait'
              : retrainState === 'failed'
              ? 'bg-red-500/10 hover:bg-red-500/20 border-red-500/30 text-red-400'
              : 'bg-[#0E9E78]/10 hover:bg-[#0E9E78]/20 border border-[#0e9e78]/30 text-[#0E9E78]'
          }`}
        >
          <RefreshCw className={`w-3 h-3 ${retrainState === 'running' ? 'animate-spin' : ''}`} />
          {retrainState === 'running' ? 'Retraining…' : retrainState === 'ok' ? 'Retrain Complete' : retrainState === 'failed' ? 'Retrain Failed — Retry?' : 'Retrain Model Net'}
        </button>
        )}
      </div>

      {/* DOUBLE GRAPH GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ForecastChart />
        <CorrelationChart />
      </div>

      {/* WEATHER & SEASONAL CORRELATION */}
      <div className="w-full">
        {sectionsLoaded.seasons ? (
          seasons.length > 0 ? (
            <WeatherCorrelationChart seasons={seasons} />
          ) : (
            <div className="text-center py-4 text-[var(--text-muted)] text-[10px] font-mono">
              No seasonal breakdown data available for this period.
            </div>
          )
        ) : (
          <div className="bg-secondary-bg/25 border border-border-color p-8 rounded-card flex items-center justify-center">
            <span className="text-[10px] font-mono text-[var(--text-muted)] animate-pulse">Loading seasonal data...</span>
          </div>
        )}
      </div>

      {/* SEASONAL CRIME BREAKDOWN */}
      {seasons.length > 0 ? (
        <div className="bg-secondary-bg/25 border border-border-color p-5 rounded-card">
          <span className="text-[10px] font-mono font-bold text-[var(--text-muted)] uppercase tracking-widest block border-b border-[var(--border-muted)] pb-2 mb-4 flex items-center justify-between">
            <span>Karnataka Seasonal Crime Intelligence</span>
            <IntelligenceStatusBadges
              badges={{ kind: 'HISTORICAL', label: 'HISTORICAL', tooltip: 'Seasonal totals summarize recorded incidents — this is not a forecast.', tone: 'muted', priority: 6 }}
              withInfo={false}
            />
          </span>
          {seasons.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {seasons.map((s) => (
                <div key={s.season} className={`p-4 border rounded-card flex flex-col gap-2 ${SEASON_COLORS[s.season] || 'border-border-color'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase font-mono">{s.season}</span>
                    {SEASON_ICONS[s.season]}
                  </div>
                  <span className="text-xl font-bold font-mono">{s.count}</span>
                  <div className="flex items-center justify-between text-[9px] font-mono">
                    <span>{s.percentage}% of total</span>
                    {s.top_district && <span className="truncate max-w-[100px]">Peak: {s.top_district}</span>}
                  </div>
                  <div className="w-full bg-black/20 h-1.5 rounded-full overflow-hidden mt-1">
                    <div className="h-full rounded-full bg-current opacity-60" style={{ width: `${s.percentage}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-[var(--text-muted)] text-[10px] font-mono">
              No seasonal breakdown data available for this period.
            </div>
          )}
        </div>
      ) : seasonsError ? (
        <div className="bg-secondary-bg/25 border border-amber-500/30 p-4 rounded-card text-center font-mono text-[10px] text-[var(--text-muted)] flex items-center justify-between">
          <span className="flex items-center gap-2 text-amber-400">
            <AlertTriangle className="w-4 h-4" />
            {seasonsError}
          </span>
          <button onClick={() => fetchPredictions()} className="px-2.5 py-1 text-[9px] uppercase rounded border border-[var(--accent-blue)]/30 text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/10">
            Retry
          </button>
        </div>
      ) : null}

      {/* EMERGING CRIME TYPOLOGIES (30d vs prior 30d, from strategic analytics) */}
      {typologies.length > 0 ? (
        <div className="bg-secondary-bg/25 border border-border-color p-5 rounded-card">
          <div className="flex justify-between items-center border-b border-[var(--border-muted)] pb-2 mb-4">
            <span className="text-[10px] font-mono font-bold text-[var(--text-muted)] uppercase tracking-widest">
              Emerging Crime Typologies • Last 30 Days vs Prior Period
            </span>
            <IntelligenceStatusBadges
              badges={{ kind: 'HISTORICAL', label: 'HISTORICAL', tooltip: 'Observed change between two past windows — this is not a prediction.', tone: 'muted', priority: 6 }}
              withInfo={false}
            />
          </div>
          {typologies.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {typologies.map((t) => {
                const meta = TREND_META[t.direction] ?? TREND_META.stable;
                return (
                  <div key={t.category} className={`p-3.5 border rounded-card flex flex-col gap-2 ${meta.cls}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10.5px] font-bold uppercase font-mono truncate max-w-[75%]" title={t.category}>{t.category}</span>
                      {meta.icon}
                    </div>
                    <span className="text-lg font-bold font-mono">
                      {t.change_percentage > 0 ? '+' : ''}{t.change_percentage}%
                    </span>
                    <div className="text-[9px] font-mono flex items-center justify-between opacity-80">
                      <span>Recent: {t.recent_count}</span>
                      <span>Prior: {t.historical_count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-4 text-[var(--text-muted)] text-[10px] font-mono">
              No trend data available for this period.
            </div>
          )}
        </div>
      ) : typologiesError ? (
        <div className="bg-secondary-bg/25 border border-amber-500/30 p-4 rounded-card text-center font-mono text-[10px] text-[var(--text-muted)] flex items-center justify-between">
          <span className="flex items-center gap-2 text-amber-400">
            <AlertTriangle className="w-4 h-4" />
            {typologiesError}
          </span>
          <button onClick={() => fetchPredictions()} className="px-2.5 py-1 text-[9px] uppercase rounded border border-[var(--accent-blue)]/30 text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/10">
            Retry
          </button>
        </div>
      ) : null}

      {/* DETAILED STATS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Side: Insight Bullet cards (8 cols on lg) */}
        <div className="lg:col-span-8 bg-secondary-bg/25 border border-border-color p-5 rounded-card flex flex-col gap-4">
          <span className="text-[10px] font-mono font-bold text-[var(--text-muted)] uppercase tracking-widest block border-b border-[var(--border-muted)] pb-2">
            Strategic Threat Assessments {modelInfo ? `• ${modelInfo.version}` : ''}
          </span>
          
          {riskScoresError ? (
            <div className="p-4 bg-[var(--bg-secondary)]/45 border border-amber-500/30 rounded-card flex items-center justify-between text-xs font-mono text-amber-400">
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {riskScoresError}
              </span>
              <button onClick={() => fetchPredictions()} className="px-2.5 py-1 text-[9px] uppercase rounded border border-[var(--accent-blue)]/30 text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/10">
                Retry
              </button>
            </div>
          ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
            {predictionRows.slice(0, 2).map((row) => {
              const confidence = getConfidenceLabel(row.confidence);
              const rowBadges = getIntelligenceStatus({
                predictionMode: riskScores?.prediction_mode,
                dataProvenance: riskScores?.data_provenance,
              }).filter((b) => b.kind !== 'UNKNOWN');
              return (
                <div key={row.district} className="p-3.5 bg-[var(--bg-secondary)]/45 border border-[var(--border-primary)] rounded-btn flex gap-3 relative overflow-hidden">
                  {!canSelectDistrict && row.district === scopeDistrict && (
                    <span className="absolute top-2 right-2 rounded-full bg-[var(--accent-blue)]/15 border border-[var(--accent-blue)]/30 px-2 py-0.5 text-[8.5px] font-semibold uppercase tracking-wider text-[var(--accent-blue)]">
                      Your district
                    </span>
                  )}
                  <ShieldAlert className="w-5 h-5 text-[#C94A2A] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-[var(--text-primary)] font-bold uppercase text-[10.5px]">{row.district} risk score {row.risk_score}%</span>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <IntelligenceStatusBadges badges={rowBadges} withInfo={false} />
                      {confidence?.lowConfidence && (
                        <IntelligenceStatusBadges
                          badges={{ kind: 'LOW_CONFIDENCE', label: 'LOW CONFIDENCE', tooltip: 'Interpret this result cautiously because the underlying evidence or model status is incomplete.', tone: 'warn', priority: 5 }}
                          withInfo={false}
                        />
                      )}
                    </div>
                    <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed mt-1">
                      {/* Confidence is shown only when the backend supplies it —
                          never defaulted or derived from the score (issue 9 §7). */}
                      {confidence ? `${confidence.label} (${confidence.level}) • ` : ''}
                      Backend forecast window {riskScores?.window ?? 'No backend window'}.
                    </p>
                  </div>
                </div>
              );
            })}

            {anomalies.slice(0, 2).map((anomaly) => (
              <div key={anomaly.case_id} className="p-3.5 bg-[var(--bg-secondary)]/45 border border-[var(--border-primary)] rounded-btn flex gap-3 relative overflow-hidden">
                <Sparkles className="w-5 h-5 text-[#0E9E78] shrink-0" />
                <div>
                  <span className="text-[var(--text-primary)] font-bold uppercase text-[10.5px]">{anomaly.label}</span>
                  <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed mt-1">
                    {anomaly.reason} • Case {anomaly.case_id}.
                  </p>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>

        {/* Right Side: Performance stats (4 cols on lg) */}
        <div className="lg:col-span-4 bg-secondary-bg/25 border border-border-color p-5 rounded-card flex flex-col justify-between">
          <span className="text-[10px] font-mono font-bold text-[var(--text-muted)] uppercase tracking-widest block border-b border-[var(--border-muted)] pb-2 select-none">
            Predictive Model Metrics
          </span>

          <div className="flex-1 flex flex-col justify-center gap-3.5 py-4 font-mono text-xs">
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-muted)]">Algorithm Model</span>
              <span className="text-[var(--text-primary)] font-bold">{modelInfo?.risk_algorithm ?? 'No backend model'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-muted)]">Root Mean Square Error</span>
              <span className="text-orange-400 font-bold">
                {modelInfo?.risk_metrics?.rmse ? modelInfo.risk_metrics.rmse.toFixed(4) : (modelInfo?.risk_model_loaded === false ? 'Rule-based fallback active' : 'No backend metric')}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-muted)]">Verification Dataset</span>
              <span className="text-[var(--text-primary)] font-bold">{modelInfo?.training_rows ? `${modelInfo.training_rows} rows` : `${predictionRows.length} risk clusters`}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-muted)]">Last Epoch updates</span>
              <span className="text-[#0E9E78] font-bold">{modelInfo?.trained_on ? new Date(modelInfo.trained_on).toLocaleDateString() : (riskScores?.window ?? 'No backend window')}</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
export default Predictions;

