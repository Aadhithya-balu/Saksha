import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AlertCircle } from 'lucide-react';

interface ActiveAlerts3DProps {
  alertRows: any[];
  anomalies: any[];
}

interface AlertItem {
  label: string;
  shortLabel: string;
  score: number;
}

export const ActiveAlerts3D: React.FC<ActiveAlerts3DProps> = ({ alertRows = [], anomalies = [] }) => {
  const unifiedAlerts = useMemo(() => {
    const list: AlertItem[] = [];

    alertRows.forEach((r) => {
      const shortName = r.name || 'Station';
      const rawScore = r.score ?? r.weight ?? r.baseScore;
      if (typeof rawScore !== 'number' || !Number.isFinite(rawScore)) return;
      const catVal = r.category || r.type || 'Unclassified';
      list.push({ label: `${r.name} - ${catVal}`, shortLabel: shortName.replace(/police station/i, 'PS'), score: rawScore });
    });

    anomalies.forEach((a) => {
      let shortName = 'Anomaly';
      if (a.label?.includes('logins') || a.reason?.includes('logins')) shortName = 'Multi Login';
      else if (a.reason?.includes('dossiers') || a.label?.includes('dossiers')) shortName = 'Bulk Export';
      const rawAnomaly = typeof a.score === 'number' && Number.isFinite(a.score) ? (a.score <= 1 ? Math.round(a.score * 100) : Math.round(a.score)) : null;
      if (rawAnomaly === null) return;
      list.push({ label: a.label || a.reason || 'System Anomaly', shortLabel: shortName, score: rawAnomaly });
    });

    return list.slice(0, 5);
  }, [alertRows, anomalies]);

  const getBarColor = (score: number) => {
    if (score >= 90) return '#C94A2A';
    if (score >= 75) return '#D4820A';
    return '#1E6FD9';
  };

  interface CustomTooltipProps {
    active?: boolean;
    payload?: Array<{ payload: AlertItem }>;
  }

  const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    const color = getBarColor(d.score);
    return (
    <div className="bg-[#0c1424] border rounded shadow-2xl p-3 flex flex-col gap-1 w-48 font-mono pointer-events-none" style={{ borderColor: color }}>
      <span className="text-[10px] text-[#E8EDF5] font-extrabold uppercase truncate">{d.label}</span>
      <div className="flex justify-between items-center mt-1 border-t border-[#1a2744] pt-1">
        <span className="text-[8px] text-[#8a99ad]">THREAT SCORE:</span>
        <span className="text-[11px] font-bold" style={{ color }}>{d.score}%</span>
      </div>
    </div>
    );
  };

  return (
    <div className="w-full flex flex-col gap-3 flex-grow font-mono">
      {/* Horizontal Bar Chart */}
      <div className="w-full min-h-[150px] flex-grow">
        {unifiedAlerts.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={unifiedAlerts} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 5 }} barCategoryGap="18%">
              <XAxis type="number" domain={[0, 100]} stroke="#A8B4CC" tickLine={false} axisLine={false} style={{ fill: 'var(--text-primary)', fontSize: '9px', fontWeight: 'bold' }} />
              <YAxis type="category" dataKey="shortLabel" stroke="#A8B4CC" tickLine={false} axisLine={false} dx={-4} width={80} style={{ fill: 'var(--text-primary)', fontSize: '8.5px', fontWeight: 'bold' }} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="score" radius={[0, 4, 4, 0]} maxBarSize={22}>
                {unifiedAlerts.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getBarColor(entry.score)} opacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
            No Pending Active Alerts
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex justify-between text-[8px] text-[var(--text-secondary)] font-bold uppercase tracking-widest pt-2 border-t border-[var(--border-primary)] select-none">
        <span className="flex items-center gap-1">
          <AlertCircle className="w-3 h-3 text-[var(--accent-coral)]" />
          Hover for full labels
        </span>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-coral)]" /> HIGH (&gt;90%)</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-amber)]" /> MED</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-blue)]" /> LOW</span>
        </div>
      </div>
    </div>
  );
};
