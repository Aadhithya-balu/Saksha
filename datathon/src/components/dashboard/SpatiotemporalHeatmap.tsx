import React, { useState, useEffect, useMemo } from 'react';
import { Flame } from 'lucide-react';
import {
  getSociologicalTemporal,
  getSociologicalTemporalMatrix,
  type TemporalDemographic,
  type TemporalMatrixResponse,
} from '../../services/api';

export interface HeatmapCell {
  day: string;
  hour: string;
  intensity: number;
  cases: number;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'];

const DOW_FULL_TO_SHORT: Record<string, string> = {
  'Monday': 'Mon',
  'Tuesday': 'Tue',
  'Wednesday': 'Wed',
  'Thursday': 'Thu',
  'Friday': 'Fri',
  'Saturday': 'Sat',
  'Sunday': 'Sun',
};

const buildCellsFromDemographics = (temporal?: TemporalDemographic | null): HeatmapCell[] => {
  // Honest derivation from real observed marginal distributions only
  // (issue #282 §20): with no backend data there is NO synthetic baseline —
  // the UI renders an empty state instead.
  if (!temporal) return [];
  const cells: HeatmapCell[] = [];

  const dayMap: Record<string, number> = {};
  if (Array.isArray(temporal?.day_of_week_distribution)) {
    temporal.day_of_week_distribution.forEach(d => {
      const short = DOW_FULL_TO_SHORT[d.day] || (d.day ? d.day.slice(0, 3) : '');
      if (short) dayMap[short] = d.count;
    });
  }

  const hourMap: Record<string, number> = {};
  if (Array.isArray(temporal?.hourly_distribution)) {
    temporal.hourly_distribution.forEach(h => {
      if (h.hour) hourMap[h.hour] = h.count;
    });
  }

  const totalHourCounts = Object.values(hourMap).reduce((a, b) => a + b, 0);
  if (totalHourCounts <= 0) return [];

  DAYS.forEach(day => {
    const dayTotal = dayMap[day] ?? 0;
    HOURS.forEach(hour => {
      // Find 4-hour window sum around this anchor hour
      const hourNum = parseInt(hour.split(':')[0], 10);
      let windowSum = 0;
      for (let offset = 0; offset < 4; offset++) {
        const hKey = `${String((hourNum + offset) % 24).padStart(2, '0')}:00`;
        windowSum += hourMap[hKey] ?? 0;
      }
      const hourRatio = windowSum / totalHourCounts;
      const cases = Math.round(dayTotal * hourRatio * 4);
      cells.push({ day, hour, intensity: cases, cases });
    });
  });

  return cells;
};

// Gap 131.3: build cells from the true observed hour x day incident matrix
// served by GET /sociological/temporal-matrix (4-hour bins to anchor columns).
const buildCellsFromMatrix = (matrix?: TemporalMatrixResponse | null): HeatmapCell[] => {
  if (!matrix || !Array.isArray(matrix.matrix)) return [];
  const bins: Record<string, number> = {};
  matrix.matrix.forEach(row => {
    const anchor = String(Math.floor((row.hour ?? 0) / 4) * 4).padStart(2, '0') + ':00';
    row.cells?.forEach(cell => {
      const short = DOW_FULL_TO_SHORT[cell.day] || (cell.day ? cell.day.slice(0, 3) : '');
      if (!short) return;
      const key = `${short}|${anchor}`;
      bins[key] = (bins[key] ?? 0) + (cell.count ?? 0);
    });
  });
  if (!Object.keys(bins).length) return [];
  const cells: HeatmapCell[] = [];
  DAYS.forEach(day => {
    HOURS.forEach(hour => {
      const cases = bins[`${day}|${hour}`] ?? 0;
      cells.push({ day, hour, intensity: cases, cases });
    });
  });
  return cells;
};

interface SpatiotemporalHeatmapProps {
  data?: HeatmapCell[];
  onCellClick?: (day: string, hour: string) => void;
  selectedHour?: number | null;
}

const getHeatColor = (cases: number): string => {
  if (cases >= 75) return 'rgba(201, 74, 42, 0.85)';
  if (cases >= 60) return 'rgba(212, 130, 10, 0.8)';
  if (cases >= 45) return 'rgba(108, 67, 204, 0.7)';
  return 'rgba(30, 111, 217, 0.55)';
};

const getStatusLabel = (cases: number) => {
  if (cases >= 75) return { text: 'Critical Density', color: '#C94A2A' };
  if (cases >= 50) return { text: 'Elevated Alert', color: '#D4820A' };
  return { text: 'Normal Patrol', color: '#1E6FD9' };
};

export const SpatiotemporalHeatmap: React.FC<SpatiotemporalHeatmapProps> = ({ data: propData, onCellClick, selectedHour }) => {
  const [hoveredCell, setHoveredCell] = useState<{ day: string; hour: string; cases: number } | null>(null);
  const [temporalData, setTemporalData] = useState<TemporalDemographic | null>(null);
  const [matrixData, setMatrixData] = useState<TemporalMatrixResponse | null>(null);

  useEffect(() => {
    if (propData && propData.length > 0) return;
    let isMounted = true;
    // Prefer the true observed hour x day matrix; fall back to marginals.
    getSociologicalTemporalMatrix()
      .then(res => {
        if (isMounted) setMatrixData(res);
      })
      .catch(() => {
        getSociologicalTemporal()
          .then(res => {
            if (isMounted) setTemporalData(res);
          })
          .catch(() => undefined);
      });
    return () => { isMounted = false; };
  }, [propData]);

  const heatmapData = useMemo(() => {
    if (propData && propData.length > 0) return propData;
    const fromMatrix = buildCellsFromMatrix(matrixData);
    if (fromMatrix.length > 0) return fromMatrix;
    return buildCellsFromDemographics(temporalData);
  }, [propData, temporalData, matrixData]);

  const usingData = Boolean(propData?.length || buildCellsFromMatrix(matrixData).length || temporalData);

  return (
    <div className="w-full h-full bg-[var(--bg-secondary)]/80 border border-[var(--border-primary)] p-4 rounded-lg flex flex-col justify-between select-none font-mono relative overflow-hidden group">
      {/* Title */}
      <div className="flex justify-between items-center mb-2">
        <div>
          <h4 className="text-[11.5px] font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-[var(--accent-coral)]" />
            Spatiotemporal Incident Heatmap
          </h4>
          <span className="text-[9px] text-[var(--text-secondary)] uppercase font-semibold">
            Day x Hour Crime Density Grid {usingData ? '(Database-Backed)' : '(No Data)'}
          </span>
        </div>
        {!usingData && (
          <span
            title="Observed incident data is not available for this scope, so no grid is rendered — nothing is estimated."
            aria-label="No recorded incident data available"
            role="status"
            className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded border bg-amber-500/15 border-amber-500/40 text-amber-400 font-mono text-[8.5px] font-bold uppercase tracking-wide cursor-help"
          >
            No Data
          </span>
        )}
        {selectedHour !== null && selectedHour !== undefined && (
          <span className="text-[9.5px] text-[var(--accent-blue)] font-bold px-2 py-0.5 bg-[var(--accent-blue)]/10 border border-[var(--accent-blue)]/30 rounded">
            Selected: {String(selectedHour).padStart(2, '0')}:00
          </span>
        )}
      </div>

      {/* Heatmap Grid */}
      <div className="flex-grow w-full flex flex-col justify-center">
        {!usingData ? (
          <div className="h-full w-full flex items-center justify-center">
            <div className="text-center">
              <p className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wider">No recorded incident data</p>
              <p className="text-[9px] font-mono text-[var(--text-muted)] mt-1.5 max-w-[280px]">
                The day x hour heatmap needs observed incident records. Real data will appear here as it is tracked — nothing is synthesized.
              </p>
            </div>
          </div>
        ) : (
          <>
        {/* Hour labels header */}
        <div className="flex items-center mb-1">
          <div className="w-[44px] shrink-0" />
          {HOURS.map(hour => {
            const hourInt = parseInt(hour.split(':')[0], 10);
            const isHighlighted = selectedHour !== null && selectedHour !== undefined && Math.abs(selectedHour - hourInt) < 4;
            return (
              <div 
                key={hour} 
                className={`flex-1 text-center text-[8px] uppercase font-bold tracking-wider ${
                  isHighlighted ? 'text-[var(--accent-blue)] font-extrabold' : 'text-[var(--text-muted)]'
                }`}
              >
                {hour}
              </div>
            );
          })}
        </div>

        {/* Grid rows */}
        {DAYS.map(day => (
          <div key={day} className="flex items-center mb-1">
            <div className="w-[44px] shrink-0 text-[8.5px] text-[var(--text-secondary)] uppercase font-bold tracking-wider">{day}</div>
            <div className="flex-1 flex gap-[3px]">
              {HOURS.map(hour => {
                const cell = heatmapData.find(c => c.day === day && c.hour === hour);
                const cases = cell?.cases ?? 0;
                const isHovered = hoveredCell?.day === day && hoveredCell?.hour === hour;
                return (
                  <div
                    key={`${day}-${hour}`}
                    className="flex-1 rounded-sm cursor-pointer transition-all duration-150 relative flex items-center justify-center"
                    style={{
                      backgroundColor: getHeatColor(cases),
                      height: '36px',
                      opacity: isHovered ? 1 : hoveredCell ? 0.5 : 0.85,
                      transform: isHovered ? 'scale(1.08)' : 'scale(1)',
                      zIndex: isHovered ? 10 : 1,
                    }}
                    onClick={() => onCellClick?.(day, hour)}
                    onMouseEnter={() => setHoveredCell({ day, hour, cases })}
                    onMouseLeave={() => setHoveredCell(null)}
                  >
                    <span className="text-[8px] font-bold text-white/90 drop-shadow-sm">{cases}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
          </>
        )}
      </div>

      {/* Hover Tooltip */}
      {hoveredCell && (
        <div className="absolute top-14 right-4 z-20 p-2.5 bg-[#0c1424] border border-[var(--accent-coral)] rounded shadow-2xl flex flex-col gap-1 w-48 font-mono pointer-events-none animate-[fadeIn_0.15s_ease-out]">
          <span className="text-[9.5px] text-[#E8EDF5] font-extrabold uppercase">{hoveredCell.day} @ {hoveredCell.hour}</span>
          <div className="flex justify-between items-center mt-1">
            <span className="text-[8px] text-[#8a99ad]">INCIDENT CASES:</span>
            <span className="text-[11px] font-bold text-[#E8EDF5]">{hoveredCell.cases} Cases</span>
          </div>
          <div className="flex justify-between items-center mt-0.5">
            <span className="text-[8px] text-[#8a99ad]">STATUS LEVEL:</span>
            <span className="text-[8px] font-bold uppercase" style={{ color: getStatusLabel(hoveredCell.cases).color }}>
              {getStatusLabel(hoveredCell.cases).text}
            </span>
          </div>
        </div>
      )}

      {/* Legend & Footer */}
      <div className="flex flex-wrap justify-between items-center gap-x-2 gap-y-1 text-[9px] text-[var(--text-primary)] font-bold uppercase tracking-widest pt-2 border-t border-[var(--border-primary)] select-none mt-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: 'rgba(201, 74, 42, 0.85)' }} /> High (&gt;75)</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: 'rgba(212, 130, 10, 0.8)' }} /> Elevated (60-75)</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: 'rgba(108, 67, 204, 0.7)' }} /> Moderate (45-60)</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: 'rgba(30, 111, 217, 0.55)' }} /> Low (&lt;45)</span>
        </div>
        <span>Spatiotemporal Matrix</span>
      </div>

      <div className="absolute inset-0 chart-diagonal-grid opacity-5 pointer-events-none -z-10" />
    </div>
  );
};

export default SpatiotemporalHeatmap;
