import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { BarChart2, MapPin } from 'lucide-react';

export interface SectorThreatDatum {
  name: string;
  score: number;
  category: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: SectorThreatDatum & { color: string } }>;
}

const scoreColor = (score: number): string => {
  if (score > 85) return '#C94A2A';
  if (score >= 50) return '#D4820A';
  return '#0E9E78';
};

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-[#0c1424] border rounded shadow-2xl p-3 flex flex-col gap-1 w-48 font-mono pointer-events-none" style={{ borderColor: d.color }}>
      <span className="text-[10px] text-[#E8EDF5] font-extrabold uppercase truncate">{d.name} Beat Sector</span>
      <div className="flex justify-between items-center mt-1">
        <span className="text-[8px] text-[#8a99ad]">THREAT INDEX:</span>
        <span className="text-[11px] font-bold" style={{ color: d.color }}>{d.score}%</span>
      </div>
      <div className="flex justify-between items-center mt-0.5">
        <span className="text-[8px] text-[#8a99ad]">DOMINANT CRIME:</span>
        <span className="text-[8.5px] text-[#E8EDF5] font-semibold truncate">{d.category}</span>
      </div>
    </div>
  );
};

interface SpatialCube3DProps {
  data?: SectorThreatDatum[];
}

export const SpatialCube3D: React.FC<SpatialCube3DProps> = ({ data = [] }) => {
  const chartData = data.map((d) => ({ ...d, color: scoreColor(d.score) }));

  return (
    <div className="w-full h-full bg-[var(--bg-secondary)]/80 border border-[var(--border-primary)] p-4 rounded-lg flex flex-col justify-between select-none font-mono relative group overflow-hidden">
      {/* Title */}
      <div className="flex justify-between items-center mb-2">
        <div>
          <h4 className="text-[11.5px] font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
            <BarChart2 className="w-4 h-4 text-[var(--accent-blue)]" />
            Beat Sector Threat Index
          </h4>
          <span className="text-[9px] text-[var(--text-secondary)] uppercase font-semibold">Sector-wise Crime Density Analysis</span>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="flex-grow w-full min-h-[170px] flex flex-col items-center justify-center gap-2 text-center">
          <MapPin className="w-5 h-5 text-[var(--text-muted)]" />
          <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold">No sector threat data available</span>
          <span className="text-[9px] text-[var(--text-disabled)]">Sector index appears once hotspot intelligence is loaded.</span>
        </div>
      ) : (
        <div className="flex-grow w-full min-h-[170px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barCategoryGap="20%">
              <XAxis dataKey="name" stroke="#A8B4CC" tickLine={false} axisLine={false} dy={6} style={{ fill: 'var(--text-primary)', fontSize: '9px', fontWeight: 'bold' }} />
              <YAxis stroke="#A8B4CC" tickLine={false} axisLine={false} dx={-6} domain={[0, 100]} style={{ fill: 'var(--text-primary)', fontSize: '10px', fontWeight: 'bold' }} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="score" radius={[4, 4, 0, 0]} maxBarSize={48}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} opacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Legend */}
      <div className="flex justify-between text-[9px] text-[var(--text-primary)] font-bold uppercase tracking-widest pt-2 border-t border-[var(--border-primary)] select-none">
        <span className="flex items-center gap-2">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[var(--accent-coral)]" /> HIGH (&gt;85%)</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[var(--accent-amber)]" /> MEDIUM (50-85%)</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[var(--accent-teal)]" /> LOW (&lt;50%)</span>
        </span>
        <span>Hotspot Threat Index</span>
      </div>

      <div className="absolute inset-0 chart-diagonal-grid opacity-5 pointer-events-none -z-10" />
    </div>
  );
};

export default SpatialCube3D;
