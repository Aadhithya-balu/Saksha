import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { HelpCircle } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useThemePalettes, tooltipStyle } from '../../theme';

import type { ForecastResponse } from '../../services/api';

interface ForecastChartProps {
  data?: ForecastResponse | null;
}

const REASON_LABEL: Record<string, string> = {
  'insufficient historical data': 'Insufficient historical records for a statistically meaningful forecast.',
  'forecast computation failed': 'The forecast model could not compute a projection right now.',
  'trained forecast model not available': 'No trained forecast model is available for this scope.',
};

export const ForecastChart: React.FC<ForecastChartProps> = ({ data }) => {
  const theme = useAppStore((s) => s.theme);
  const palette = useThemePalettes();
  const c = palette.chart;
  const histColor = c.series[0];
  const todayColor = c.series[1];
  const predColor = c.series[5];

  // Honest availability gate (issue #282 §15): a forecast is only shown when
  // the backend returned one. No static demo fallback is ever rendered.
  const isLive = Boolean(data?.available && data.series && data.series.length > 0);
  const reasonLabel = (data?.reason && REASON_LABEL[data.reason]) || data?.reason || null;

  if (!isLive) {
    return (
      <div className="sk-panel sk-panel-pad w-full h-[280px] relative overflow-hidden flex flex-col">
        <div className="flex justify-between items-start mb-2">
          <div>
            <span className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5" />
              Predictive Telemetry
            </span>
            <h4 className="sk-panel-title mt-0.5">14-Day Crime Trajectory (Forecast)</h4>
          </div>
          <span
            title="The forecast model needs enough historical records before it produces a projection."
            className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded border bg-amber-500/15 border-amber-500/40 text-amber-400 font-mono text-[8.5px] font-bold uppercase tracking-wide"
          >
            Unavailable
          </span>
        </div>

        <div className="flex-1 w-full min-h-[200px] my-auto flex items-center justify-center">
          <div className="max-w-sm text-center">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Forecast unavailable</p>
            <p className="text-xs font-mono text-[var(--text-muted)] mt-1.5">
              {reasonLabel ?? 'No forecast data is available for this scope right now.'}
            </p>
            <p className="text-[10px] font-mono text-[var(--text-muted)] mt-1">
              Estimated when {data?.sample_size ?? 0} historical incident records in scope
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-[var(--text-muted)] pt-2 border-t border-[var(--border-muted)] mt-1">
          <span className="ml-auto flex items-center gap-1" title="No fabricated values are ever shown.">
            <HelpCircle className="w-3 h-3" />
            Real data only
          </span>
        </div>
      </div>
    );
  }

  const chartData = data.series.map((pt) => ({
    day: pt.day,
    value: pt.value,
    type: pt.type,
  }));

  return (
    <div className="sk-panel sk-panel-pad w-full h-[280px] relative overflow-hidden flex flex-col">
      <div className="flex justify-between items-start mb-2">
        <div>
          <span className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5" />
            Predictive Telemetry
          </span>
          <h4 className="sk-panel-title mt-0.5">14-Day Crime Trajectory (Forecast)</h4>
        </div>
        <span
          title={`Generated dynamically by SAKSHA forecast model${data.method_version ? ` (${data.method_version})` : ''}.`}
          className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded border bg-emerald-500/15 border-emerald-500/40 text-emerald-400 font-mono text-[8.5px] font-bold uppercase tracking-wide"
        >
          Live Forecast
        </span>
      </div>

      <div className="flex-1 w-full min-h-[200px] my-auto">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={predColor} stopOpacity={0.25} />
                <stop offset="95%" stopColor={predColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="day" tickLine={false} axisLine={false} dy={6} tick={{ fill: c.axis, fontSize: 10.5 }} interval={Math.max(1, Math.round(chartData.length / 7) - 1)} />
            <YAxis tickLine={false} axisLine={false} dx={-4} tick={{ fill: c.axis, fontSize: 10.5 }} />
            <Tooltip
              contentStyle={tooltipStyle(theme)}
              formatter={(value: number) => [`${value} incidents`, 'Incidents']}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={predColor}
              fillOpacity={1}
              fill="url(#forecastGrad)"
              strokeWidth={2}
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                const fillColor =
                  payload.type === 'today' ? todayColor : payload.type === 'predicted' ? predColor : histColor;
                return <circle key={payload.day} cx={cx} cy={cy} r={3} fill={fillColor} stroke="none" />;
              }}
              activeDot={{ r: 5, strokeWidth: 2 }}
              name="Incidents"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-[var(--text-muted)] pt-2 border-t border-[var(--border-muted)] mt-1">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: histColor }} /> Historical</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: todayColor }} /> Today</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: predColor }} /> Projected</span>
        <span className="ml-auto text-[9px] text-[var(--text-muted)]">
          Estimated from {data.sample_size} incident records
        </span>
      </div>
    </div>
  );
};

export default ForecastChart;