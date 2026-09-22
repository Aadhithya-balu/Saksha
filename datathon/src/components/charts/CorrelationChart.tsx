import React, { useEffect, useMemo, useState } from 'react';
import * as d3 from 'd3';
import { useThemePalettes } from '../../theme';
import { getSociologicalSocioeconomic, type SocioeconomicAnalysis } from '../../services/api';

interface ScatterPoint {
  district: string;
  unemployment: number; // in percentage
  riskScore: number;     // 0-100
  populationDensity: number; // size factor
}

export const CorrelationChart: React.FC = () => {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; data: ScatterPoint } | null>(null);
  const [analysis, setAnalysis] = useState<SocioeconomicAnalysis | null>(null);
  const [failed, setFailed] = useState(false);
  const palette = useThemePalettes();
  const c = palette.chart;
  const map = palette.map;

  useEffect(() => {
    let isMounted = true;
    getSociologicalSocioeconomic()
      .then((response) => {
        if (isMounted) setAnalysis(response);
      })
      .catch(() => {
        if (isMounted) setFailed(true);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const points: ScatterPoint[] = useMemo(() => {
    const districts = analysis?.districts ?? [];
    return districts
      .filter((d) => d.risk_index !== null && d.unemployment_rate !== null)
      .map((d) => ({
        district: d.district,
        unemployment: d.unemployment_rate,
        riskScore: d.risk_index as number,
        populationDensity: d.population_density || 1,
      }));
  }, [analysis]);

  // Chart Dimensions
  const width = 500;
  const height = 300;
  const padding = { top: 30, right: 30, bottom: 50, left: 55 };

  // D3 Scales Setup — domains derived from the live dataset
  const xScale = useMemo(() => {
    const values = points.map((p) => p.unemployment);
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 1;
    const pad = Math.max((max - min) * 0.15, 0.4);
    return d3.scaleLinear().domain([min - pad, max + pad]).range([padding.left, width - padding.right]);
  }, [points]);

  const yScale = useMemo(() => {
    const values = points.map((p) => p.riskScore);
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 1;
    const pad = Math.max((max - min) * 0.15, 5);
    return d3.scaleLinear().domain([Math.max(0, min - pad), max + pad]).range([height - padding.bottom, padding.top]);
  }, [points]);

  const sizeScale = useMemo(() => {
    const values = points.map((p) => p.populationDensity);
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 1;
    return d3.scaleLinear().domain([min, max]).range([4.5, 14]);
  }, [points]);

  const xTicks = xScale.ticks(6);
  const yTicks = yScale.ticks(6);

  // Compute best-fit linear regression values (Y = mX + c) for the trendline
  const regression = useMemo(() => {
    if (points.length < 2) return null;
    const xVals = points.map((d) => d.unemployment);
    const yVals = points.map((d) => d.riskScore);
    const sumX = xVals.reduce((a, b) => a + b, 0);
    const sumY = yVals.reduce((a, b) => a + b, 0);
    const sumXY = xVals.reduce((sum, x, idx) => sum + x * yVals[idx], 0);
    const sumXX = xVals.reduce((sum, x) => sum + x * x, 0);
    const count = points.length;

    const denom = count * sumXX - sumX * sumX;
    if (denom === 0) return null;
    const slope = (count * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / count;

    const domain = xScale.domain() as [number, number];

    return {
      x1: xScale(domain[0]),
      y1: yScale(slope * domain[0] + intercept),
      x2: xScale(domain[1]),
      y2: yScale(slope * domain[1] + intercept),
    };
  }, [points, xScale, yScale]);

  const hasData = points.length > 0;

  return (
    <div className="w-full bg-[var(--bg-tertiary)]/40 border border-border-color p-4 rounded-card relative overflow-hidden flex flex-col justify-between h-[360px] select-none">

      {/* Chart Title */}
      <div className="flex justify-between items-center mb-3">
        <span className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-[var(--accent-teal)] uppercase font-bold tracking-wider">
            SOCIO-ECONOMIC CORRELATION
          </span>
          {analysis?.dataset?.demo_data && (
            <span
              title="Some records used in this analysis are seeded/demo data and should not be treated as live operational intelligence."
              aria-label="Demo data: analysis includes seeded/demo records"
              role="status"
              className="inline-flex items-center px-1.5 py-0.5 rounded border bg-amber-500/15 border-amber-500/40 text-amber-400 font-mono text-[8px] font-bold uppercase tracking-wide cursor-help"
            >
              Demo Data
            </span>
          )}
        </span>
        <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase select-none">
          Unemployment Vs Crime Risk{analysis?.correlations.unemployment_vs_crime !== null && analysis?.correlations.unemployment_vs_crime !== undefined ? ` · r=${analysis.correlations.unemployment_vs_crime.toFixed(2)}` : ''}
        </span>
      </div>

      {!hasData && (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 my-auto">
          <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase">
            {failed
              ? 'Socio-economic data unavailable — backend unreachable.'
              : 'No district crime data yet — unemployment correlation appears once cases are recorded.'}
          </span>
          {analysis?.dataset && (
            <span className="text-[8px] font-mono text-[var(--text-muted)] uppercase opacity-70">
              Reference dataset v{analysis.dataset.version}
              {analysis.dataset.data_years?.length ? ` · source period ${analysis.dataset.data_years.join(', ')}` : ''}
            </span>
          )}
        </div>
      )}

      {hasData && (
        <div className="relative flex-1 flex flex-col justify-center my-auto">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[220px] overflow-visible">
            {/* Dashed grid coordinates */}
            <g stroke={c.grid} strokeWidth="0.5" strokeDasharray="3 3">
              {xTicks.map((tick, i) => (
                <line key={i} x1={xScale(tick)} y1={padding.top} x2={xScale(tick)} y2={height - padding.bottom} />
              ))}
              {yTicks.map((tick, i) => (
                <line key={i} x1={padding.left} y1={yScale(tick)} x2={width - padding.right} y2={yScale(tick)} />
              ))}
            </g>

            {/* Axes outlines */}
            <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke={c.grid} strokeWidth="1" />
            <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke={c.grid} strokeWidth="1" />

            {/* Axis Labels */}
            {xTicks.map((tick, i) => (
              <text key={i} x={xScale(tick)} y={height - padding.bottom + 16} className="text-[10px] font-mono font-bold fill-[var(--text-primary)] text-center" textAnchor="middle">
                {tick}%
              </text>
            ))}
            {yTicks.map((tick, i) => (
              <text key={i} x={padding.left - 10} y={yScale(tick) + 3} className="text-[10px] font-mono font-bold fill-[var(--text-primary)] text-right" textAnchor="end">
                {tick}
              </text>
            ))}

            {/* Linear regression best-fit slope path */}
            {regression && (
              <line
                x1={regression.x1}
                y1={regression.y1}
                x2={regression.x2}
                y2={regression.y2}
                stroke={c.series[1]}
                strokeWidth="1.5"
                strokeDasharray="4 4"
                className="opacity-70"
              />
            )}

            {/* Node Scatter Clusters */}
            {points.map((p, idx) => {
              const cx = xScale(p.unemployment);
              const cy = yScale(p.riskScore);
              const r = sizeScale(p.populationDensity);

              // High risk highlight thresholds
              const isSevere = p.riskScore > 65;
              const fill = isSevere ? map.hotspotHigh : map.hotspotMedium;

              return (
                <g key={idx} className="cursor-pointer transition-transform duration-150">
                  <circle
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill={fill}
                    fillOpacity={0.8}
                    stroke={c.grid}
                    strokeWidth="1"
                    className="hover:opacity-100 hover:scale-125"
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTooltip({ x: rect.left, y: rect.top, data: p });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                  {/* Pin label inside larger clusters */}
                  {r > 10 && (
                    <text
                      x={cx}
                      y={cy + 3}
                      textAnchor="middle"
                      className="text-[8px] font-mono font-bold fill-white pointer-events-none select-none"
                    >
                      {p.district.slice(0, 3).toUpperCase()}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Interactive D3 Tooltip Overlay */}
          {tooltip && (
            <div
              className="absolute z-30 p-2.5 rounded text-[10px] font-mono shadow-2xl pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3"
              style={{
                left: `${(tooltip.x / width) * 100}%`,
                top: `${(tooltip.y / height) * 100}%`,
                backgroundColor: c.tooltipBg,
                border: `1px solid ${c.tooltipBorder}`,
                color: c.tooltipText,
              }}
            >
              <span className="font-bold block">{tooltip.data.district}</span>
              <div className="flex justify-between gap-3 mt-1">
                <span>Unemployment:</span>
                <span className="font-semibold">{tooltip.data.unemployment}%</span>
              </div>
              <div className="flex justify-between gap-3 mt-0.5">
                <span>Crime threat:</span>
                <span className="font-bold">{tooltip.data.riskScore}/100</span>
              </div>
              <div className="flex justify-between gap-3 mt-0.5">
                <span>Pop density:</span>
                <span className="font-semibold">{tooltip.data.populationDensity}/sq.km</span>
              </div>
            </div>
          )}

          {analysis?.dataset && (
            <span className="block mt-1 text-right text-[7.5px] font-mono text-[var(--text-muted)] uppercase opacity-60">
              Indicators: versioned reference dataset v{analysis.dataset.version}
              {analysis.dataset.data_years?.length ? ` · source period ${analysis.dataset.data_years.join(', ')}` : ''}
            </span>
          )}
        </div>
      )}

      {/* Legend & Dataset Lineage */}
      <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)] pt-2 border-t border-[var(--border-muted)] mt-1">
        <span>Trend: {regression && analysis?.correlations.unemployment_vs_crime != null ? `${analysis.correlations.unemployment_vs_crime < 0 ? 'Inverse' : 'Positive'} Correlation (r=${analysis.correlations.unemployment_vs_crime.toFixed(2)})` : regression ? 'Regression fit (r unavailable)' : 'Standard Distribution'}</span>
        {analysis?.dataset && (
          <span className="text-[9px] uppercase opacity-70">
            Dataset v{analysis.dataset.version}
          </span>
        )}
      </div>

    </div>
  );
};

export default CorrelationChart;
