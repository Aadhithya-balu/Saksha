import { useAppStore } from './store/appStore';

export type ThemeName = 'dark' | 'light';

export interface ChartPalette {
  series: string[];
  grid: string;
  axis: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
}

export interface MapPalette {
  bg: string;
  panelBg: string;
  grid: string;
  graticule: string;
  boundary: string;
  boundaryHover: string;
  districtFill: string;
  districtSelected: string;
  label: string;
  anchor: string;
  hotspotHigh: string;
  hotspotMedium: string;
  hotspotLow: string;
  haloOpacity: number;
}

const DARK: { chart: ChartPalette; map: MapPalette } = {
  chart: {
    series: ['#3b82f6', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#22d3ee', '#f472b6', '#94a3b8'],
    grid: 'rgba(148, 163, 184, 0.10)',
    axis: '#94a3b8',
    tooltipBg: 'rgba(24, 33, 44, 0.97)',
    tooltipBorder: 'rgba(148, 163, 184, 0.25)',
    tooltipText: '#f8fafc',
  },
  map: {
    bg: '#080b10',
    panelBg: 'rgba(24, 33, 44, 0.92)',
    grid: 'rgba(6, 182, 212, 0.05)',
    graticule: 'rgba(6, 182, 212, 0.10)',
    boundary: 'rgba(148, 163, 184, 0.35)',
    boundaryHover: 'rgba(6, 182, 212, 0.8)',
    districtFill: 'rgba(6, 182, 212, 0.04)',
    districtSelected: 'rgba(6, 182, 212, 0.12)',
    label: '#94a3b8',
    anchor: '#94a3b8',
    hotspotHigh: '#dc2626',
    hotspotMedium: '#d97706',
    hotspotLow: '#10b981',
    haloOpacity: 0.12,
  },
};

const LIGHT: { chart: ChartPalette; map: MapPalette } = {
  chart: {
    series: ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0284c7', '#db2777', '#64748b'],
    grid: 'rgba(15,42,92,0.08)',
    axis: '#475569',
    tooltipBg: 'rgba(255,255,255,0.98)',
    tooltipBorder: 'rgba(15,42,92,0.18)',
    tooltipText: '#0f172a',
  },
  map: {
    bg: '#ffffff',
    panelBg: 'rgba(255,255,255,0.94)',
    grid: 'rgba(15,82,186,0.06)',
    graticule: 'rgba(15,82,186,0.13)',
    boundary: 'rgba(23,58,118,0.45)',
    boundaryHover: 'rgba(15,82,186,0.95)',
    districtFill: 'rgba(15,82,186,0.04)',
    districtSelected: 'rgba(15,82,186,0.10)',
    label: '#334155',
    anchor: '#1e293b',
    hotspotHigh: '#d93414',
    hotspotMedium: '#b56e07',
    hotspotLow: '#0d7a5b',
    haloOpacity: 0.16,
  },
};

export const getThemePalettes = (theme: ThemeName) => (theme === 'light' ? LIGHT : DARK);

export const useThemePalettes = () => {
  const theme = useAppStore((s) => s.theme) as ThemeName;
  return getThemePalettes(theme);
};

/** Semantic risk score → color (theme aware). */
export const riskColor = (score: number, theme: ThemeName): string => {
  const p = getThemePalettes(theme).map;
  if (score >= 80) return p.hotspotHigh;
  if (score >= 60) return p.hotspotMedium;
  return p.hotspotLow;
};

/** Shared tooltip style object for Recharts components. */
export const tooltipStyle = (theme: ThemeName): React.CSSProperties => {
  const c = getThemePalettes(theme).chart;
  return {
    backgroundColor: c.tooltipBg,
    border: `1px solid ${c.tooltipBorder}`,
    borderRadius: 8,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12,
    color: c.tooltipText,
    boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
  };
};
