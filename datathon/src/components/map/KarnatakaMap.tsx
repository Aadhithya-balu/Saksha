import React, { useState, useEffect, useMemo } from 'react';
import { useMapStore, DISTRICT_COORDS } from '../../store/mapStore';
import type { HotspotPoint } from '../../services/api';
import type { DistrictInfo } from '../../store/mapStore';
import TimeSlider from './TimeSlider';
import { 
  Shield, X, TrendingUp, TrendingDown, AlertTriangle, 
  MapPin, ChevronRight, ChevronDown, ChevronUp, ArrowLeft, Radio, FileText, 
  Clock, Flame
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { downloadSecureDossier } from '../../utils/downloader';
import { useAuditStore } from '../../store/auditStore';
import { useAuthStore } from '../../store/authStore';
import { useThemePalettes } from '../../theme';
import { useAppStore } from '../../store/appStore';

// Reference geography for Karnataka district police stations (real station
// names and coordinates). No threat score, crime category or trend is stored
// here ? live intelligence for a station is only shown when the backend
// hotspot API actually returns it.
export interface StationRef {
  name: string;
  lat: number;
  lng: number;
}

const DISTRICT_POLICE_STATIONS: Record<string, StationRef[]> = {
  'Bengaluru Urban': [
    { name: 'Whitefield Police Station', lat: 12.9698, lng: 77.7500 },
    { name: 'Jayanagar Police Station', lat: 12.9260, lng: 77.5830 },
    { name: 'Indiranagar Police Station', lat: 12.9784, lng: 77.6408 },
    { name: 'Koramangala Police Station', lat: 12.9352, lng: 77.6245 },
    { name: 'Electronic City Police Station', lat: 12.8452, lng: 77.6602 },
    { name: 'Cubbon Park Police Station', lat: 12.9767, lng: 77.5928 },
  ],
  'Mysuru': [
    { name: 'Devaraja Police Station', lat: 12.3050, lng: 76.6480 },
    { name: 'Lashkar Police Station', lat: 12.3160, lng: 76.6550 },
    { name: 'Nazarbad Police Station', lat: 12.3100, lng: 76.6680 },
    { name: 'V.V. Puram Police Station', lat: 12.3320, lng: 76.6340 },
    { name: 'Saraswathipuram Police Station', lat: 12.3010, lng: 76.6310 },
  ],
  'Ballari': [
    { name: 'City Police Station', lat: 15.1400, lng: 76.9100 },
    { name: 'Cowl Bazaar Police Station', lat: 15.1290, lng: 76.9230 },
    { name: 'Brucepet Police Station', lat: 15.1480, lng: 76.9200 },
    { name: 'APMC Yard Police Station', lat: 15.1620, lng: 76.8980 },
  ],
  'Belagavi': [
    { name: 'Khade Bazar Police Station', lat: 15.8500, lng: 74.5100 },
    { name: 'Market Police Station', lat: 15.8620, lng: 74.5220 },
    { name: 'Camp Police Station', lat: 15.8420, lng: 74.5050 },
    { name: 'Tilakwadi Police Station', lat: 15.8350, lng: 74.5020 },
  ],
  'Kalaburagi': [
    { name: 'Brahmapur Police Station', lat: 17.3300, lng: 76.8400 },
    { name: 'Chowk Police Station', lat: 17.3410, lng: 76.8320 },
    { name: 'Station Bazaar Police Station', lat: 17.3240, lng: 76.8480 },
    { name: 'University Police Station', lat: 17.2980, lng: 76.8150 },
  ],
  'Dakshina Kannada': [
    { name: 'Surathkal Police Station', lat: 12.9800, lng: 74.8600 },
    { name: 'Mangaluru North (Bunder) Police Station', lat: 12.8710, lng: 74.8380 },
    { name: 'Mangaluru South (Pandeshwar) Police Station', lat: 12.8590, lng: 74.8420 },
    { name: 'Kadri Police Station', lat: 12.8850, lng: 74.8610 },
  ],
  'Dharwad': [
    { name: 'Dharwad Town Police Station', lat: 15.4590, lng: 75.0080 },
    { name: 'Suburban Police Station', lat: 15.4480, lng: 75.0190 },
    { name: 'Hubballi Town Police Station', lat: 15.3647, lng: 75.1240 },
    { name: 'Gokul Road Police Station', lat: 15.3520, lng: 75.0980 },
  ],
  'Tumkuru': [
    { name: 'Tumkuru Town Police Station', lat: 13.3400, lng: 77.1000 },
    { name: 'New Extension Police Station', lat: 13.3510, lng: 77.1120 },
    { name: 'Tilak Park Police Station', lat: 13.3340, lng: 77.0950 },
  ],
  'Hassan': [
    { name: 'Hassan City Police Station', lat: 13.0100, lng: 76.1000 },
    { name: 'Hassan Extension Police Station', lat: 13.0220, lng: 76.1150 },
    { name: 'Penta Police Station', lat: 12.9980, lng: 76.0880 },
  ],
  'Mandya': [
    { name: 'Mandya Town Police Station', lat: 12.5200, lng: 76.9000 },
    { name: 'Mandya Central Police Station', lat: 12.5280, lng: 76.8920 },
    { name: 'Maddur Police Station', lat: 12.5840, lng: 77.0450 },
    { name: 'Srirangapatna Police Station', lat: 12.4210, lng: 76.6950 },
  ],
  'Chitradurga': [
    { name: 'Chitradurga Town Police Station', lat: 14.2250, lng: 76.4000 },
    { name: 'Fort Police Station', lat: 14.2180, lng: 76.3950 },
    { name: 'Holalkere Police Station', lat: 14.0410, lng: 76.1820 },
  ],
  'Shivamogga': [
    { name: 'Shivamogga Town Police Station', lat: 13.9300, lng: 75.5700 },
    { name: 'Kote Police Station', lat: 13.9380, lng: 75.5820 },
    { name: 'Doddapete Police Station', lat: 13.9240, lng: 75.5610 },
  ]
};

// Coordinates projection onto custom 800x600 SVG canvas with safe margins
const projectLonX = (lon: number) => {
  // Lon 73.8 to 78.8 -> map to 70 to 670 (keeps labels from clipping on right)
  return 70 + ((lon - 73.8) / (78.8 - 73.8)) * 600;
};

const projectLatY = (lat: number) => {
  // Lat 11.5 is bottom, Lat 18.6 is top -> map to 510 to 85
  return 510 - ((lat - 11.5) / (18.6 - 11.5)) * 425;
};

// District Boundary simplified paths for UI presentation
const DISTRICT_BOUNDARIES: Record<string, [number, number][]> = {
  'Bengaluru Urban': [
    [77.4, 13.2], [77.8, 13.1], [77.8, 12.8], [77.4, 12.7], [77.3, 12.9]
  ],
  'Mysuru': [
    [76.2, 12.5], [76.7, 12.6], [77.0, 12.1], [76.5, 11.8], [76.0, 11.9]
  ],
  'Kalaburagi': [
    [76.5, 17.6], [77.2, 17.7], [77.3, 17.1], [76.7, 16.9], [76.4, 17.2]
  ],
  'Belagavi': [
    [74.2, 16.5], [74.9, 16.6], [75.2, 15.8], [74.5, 15.5], [73.9, 15.8]
  ],
  'Tumkuru': [
    [76.8, 14.1], [77.2, 13.8], [77.4, 13.2], [76.9, 13.0], [76.6, 13.4]
  ],
  'Dharwad': [
    [74.8, 15.6], [75.3, 15.7], [75.4, 15.1], [75.0, 15.0], [74.8, 15.3]
  ],
  'Ballari': [
    [76.4, 15.6], [77.1, 15.4], [77.0, 14.9], [76.5, 14.8], [76.2, 15.1]
  ],
  'Hassan': [
    [75.8, 13.3], [76.3, 13.2], [76.3, 12.7], [75.9, 12.6], [75.6, 12.9]
  ],
  'Dakshina Kannada': [
    [74.7, 13.1], [75.4, 13.0], [75.4, 12.5], [74.8, 12.6], [74.6, 12.9]
  ]
};

export interface EmergingTrendItem {
  category: string;
  recent_count: number;
  historical_count: number;
  change_percentage: number;
  direction: string;
}

type SocioIndicatorKey = 'urbanization' | 'unemployment_rate' | 'literacy_rate' | 'avg_income_lakhs' | 'crime_per_lakh';

const SOCIO_INDICATORS: Array<{ key: SocioIndicatorKey; label: string; unit: string }> = [
  { key: 'urbanization', label: 'Urbanization', unit: '' },
  { key: 'unemployment_rate', label: 'Unemployment', unit: '%' },
  { key: 'literacy_rate', label: 'Literacy', unit: '%' },
  { key: 'avg_income_lakhs', label: 'Avg Income', unit: 'L' },
  { key: 'crime_per_lakh', label: 'Crime Rate', unit: '/lakh' },
];

// Interpolate blue -> amber -> red across [0, 1] (0 = lowest value of the range)
function socioShade(t: number): { fill: string; stroke: string } {
  const clamped = Math.min(1, Math.max(0, t));
  let r: number;
  let g: number;
  let b: number;
  if (clamped < 0.5) {
    const k = clamped / 0.5;
    r = Math.round(30 + (212 - 30) * k);
    g = Math.round(111 + (130 - 111) * k);
    b = Math.round(217 + (10 - 217) * k);
  } else {
    const k = (clamped - 0.5) / 0.5;
    r = Math.round(212 + (201 - 212) * k);
    g = Math.round(130 + (74 - 130) * k);
    b = Math.round(10 + (42 - 10) * k);
  }
  return {
    fill: `rgba(${r}, ${g}, ${b}, ${0.18 + clamped * 0.3})`,
    stroke: `rgb(${r}, ${g}, ${b})`,
  };
}

interface KarnatakaMapProps {
  hotspots?: HotspotPoint[];
  districtDataOverride?: Record<string, DistrictInfo>;
  emergingTrends?: EmergingTrendItem[];
  crimeCases?: any[];
  socioEconomicData?: any[];
}

export const KarnatakaMap: React.FC<KarnatakaMapProps> = ({ 
  hotspots = [], 
  districtDataOverride,
  emergingTrends = [],
  crimeCases = [],
  socioEconomicData = [],
}) => {
  const {
    selectedDistrict,
    selectedStation,
    selectedCrimeId,
    timeOfDay,
    layers,
    districtData,
    setSelectedDistrict,
    setSelectedStation,
    setSelectedCrimeId,
    toggleLayer
  } = useMapStore();

  const { user } = useAuthStore();
  const { addLog } = useAuditStore();
  const theme = useAppStore((s) => s.theme);
  const palette = useThemePalettes();
  const map = palette.map;

  const [panelOpen, setPanelOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(true);
  const [mapZoom, setMapZoom] = useState(1);
  const [mapOffset, setMapOffset] = useState({ x: 0, y: 0 });
  const [selectedHotspot, setSelectedHotspot] = useState<any | null>(null);
  const [socioIndicator, setSocioIndicator] = useState<SocioIndicatorKey>('unemployment_rate');

  // Open drill-down details drawer whenever a district, station, or case is selected
  useEffect(() => {
    if (selectedDistrict || selectedStation || selectedCrimeId) {
      setPanelOpen(true);
    }
  }, [selectedDistrict, selectedStation, selectedCrimeId]);

  // Map socio-economic reference array by district name
  const socioEconomicMap = useMemo(() => {
    const map: Record<string, any> = {};
    socioEconomicData.forEach((item: any) => {
      if (item.district) {
        map[item.district] = item;
      }
    });
    return map;
  }, [socioEconomicData]);

  // Quantitative range for the selected indicator across all mapped districts
  const socioIndicatorRange = useMemo(() => {
    if (socioIndicator === 'urbanization') return null;
    const values = Object.values(socioEconomicMap)
      .map((item: any) => Number(item?.[socioIndicator]))
      .filter((v) => Number.isFinite(v));
    if (values.length === 0) return null;
    return { min: Math.min(...values), max: Math.max(...values) };
  }, [socioEconomicMap, socioIndicator]);

  const socioDistrictShade = (socio: any): { fill: string; stroke: string } | null => {
    if (!socio) return null;
    if (socioIndicator === 'urbanization' || !socioIndicatorRange) {
      if (socioIndicator !== 'urbanization') return null;
      return socio.urbanization_type === 'urban'
        ? { fill: 'rgba(201, 74, 42, 0.40)', stroke: '#C94A2A' }
        : socio.urbanization_type === 'semi_urban'
        ? { fill: 'rgba(212, 130, 10, 0.35)', stroke: '#D4820A' }
        : { fill: 'rgba(30, 111, 217, 0.25)', stroke: '#1E6FD9' };
    }
    const value = Number(socio[socioIndicator]);
    if (!Number.isFinite(value) || socioIndicatorRange.max === socioIndicatorRange.min) {
      return { fill: 'rgba(120, 130, 150, 0.20)', stroke: 'rgba(120, 130, 150, 0.6)' };
    }
    const t = (value - socioIndicatorRange.min) / (socioIndicatorRange.max - socioIndicatorRange.min);
    return socioShade(t);
  };

  // Sync details drawer state when district or station selection is cleared
  useEffect(() => {
    if (!selectedDistrict && !selectedStation && !selectedCrimeId) {
      setPanelOpen(false);
      setSelectedHotspot(null);
    }
  }, [selectedDistrict, selectedStation, selectedCrimeId]);

  // Calculate temporal modulation factor based on timeOfDay (hour 0-23)
  const temporalShiftInfo = useMemo(() => {
    if (timeOfDay >= 5 && timeOfDay < 12) {
      return { label: 'Morning Watch (05:00-12:00)', multiplier: 0.85, status: 'Standard Routine Patrol' };
    }
    if (timeOfDay >= 12 && timeOfDay < 17) {
      return { label: 'Afternoon Shift (12:00-17:00)', multiplier: 0.95, status: 'Active Field Surveillance' };
    }
    if (timeOfDay >= 17 && timeOfDay < 21) {
      return { label: 'Evening Peak Shift (17:00-21:00)', multiplier: 1.15, status: 'Elevated Commercial Peak' };
    }
    return { label: 'Night Beat Operation (21:00-05:00)', multiplier: 1.28, status: 'High Vulnerability Window' };
  }, [timeOfDay]);

  // Compute active hotspots dynamically modulated by timeOfDay
  const activeHotspots = useMemo(() => {
    return hotspots.map((hotspot) => {
      // Modulate threat score by temporal multiplier
      const modulatedScore = Math.min(100, Math.max(10, Math.round(hotspot.score * temporalShiftInfo.multiplier)));
      return {
        name: hotspot.name,
        lat: hotspot.lat,
        lng: hotspot.lng,
        weight: modulatedScore,
        baseScore: hotspot.score,
        type: hotspot.category,
        district_id: hotspot.district_id,
        trend: hotspot.trend,
      };
    });
  }, [hotspots, temporalShiftInfo]);

  const resolvedDistrictData = districtDataOverride ?? districtData;
  const activeDistrictInfo = useMemo(() => {
    if (!selectedDistrict) return null;
    if (resolvedDistrictData[selectedDistrict]) return resolvedDistrictData[selectedDistrict];
    const match = Object.entries(resolvedDistrictData).find(([k]) => k.toLowerCase() === selectedDistrict.toLowerCase());
    if (match) return match[1];
    // Issue 161 §1: no fabricated placeholder intelligence — when the backend
    // has no record for this district the panel renders an honest empty state
    // instead of invented counts/risk scores/station names.
    return null;
  }, [selectedDistrict, resolvedDistrictData]);

  // Reference geography + live intelligence for the selected district.
  // Station names/coordinates come from the reference table; threat score,
  // category and trend are only ever populated from backend hotspots.
  const districtStations = useMemo(() => {
    if (!selectedDistrict) return [];
    const targetDist = selectedDistrict.toLowerCase();

    const dictKey = Object.keys(DISTRICT_POLICE_STATIONS).find(k => k.toLowerCase() === targetDist);
    const refStations = dictKey ? DISTRICT_POLICE_STATIONS[dictKey] : [];

    const liveStations = activeHotspots.filter(h => (h.district_id || '').toLowerCase() === targetDist);

    const map = new Map<string, any>();
    // Backend intelligence takes precedence and is the only source of threat data.
    liveStations.forEach((s: any) => {
      if (!s.name) return;
      const score = Number(s.score ?? s.weight ?? 0);
      map.set(s.name, {
        ...s,
        district_id: selectedDistrict,
        weight: Math.min(100, Math.max(0, Math.round(score * temporalShiftInfo.multiplier))),
        baseScore: score,
        type: s.category || s.type || 'Unclassified',
        trend: s.trend || 'stable',
        hasLiveIntelligence: true,
      });
    });
    // Reference stations without backend intelligence render as geography only.
    refStations.forEach((s) => {
      if (!s.name || map.has(s.name)) return;
      map.set(s.name, {
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        district_id: selectedDistrict,
        hasLiveIntelligence: false,
      });
    });

    return Array.from(map.values());
  }, [selectedDistrict, activeHotspots, temporalShiftInfo]);

  // Rendered hotspots on map — real backend hotspots only. Reference stations
  // are never drawn as threat nodes.
  const renderedHotspots = useMemo(() => {
    if (!layers.hotspot) return [];
    return activeHotspots;
  }, [layers.hotspot, activeHotspots]);

  // Selected station object — live intelligence when available, otherwise an
  // honest geography-only reference (no invented risk score).
  const activeStationInfo = useMemo(() => {
    if (!selectedStation) return null;
    const targetStation = selectedStation.toLowerCase();
    const found = renderedHotspots.find(h => (h.name || '').toLowerCase() === targetStation)
      || activeHotspots.find(h => (h.name || '').toLowerCase() === targetStation);
    if (found) return found;
    const ref = districtStations.find((s: any) => (s.name || '').toLowerCase() === targetStation);
    if (ref) return ref;
    return null;
  }, [selectedStation, renderedHotspots, activeHotspots, districtStations]);


  // Focus targeted hotspot for on-canvas tactical badge (strictly on click/selection only)
  const activeTargetHotspot = useMemo(() => {
    if (selectedHotspot) return selectedHotspot;
    if (selectedStation) {
      return renderedHotspots.find((h: any) => (h.name || '').toLowerCase() === selectedStation.toLowerCase()) || null;
    }
    return null;
  }, [selectedHotspot, selectedStation, renderedHotspots]);

  // Filter crime cases for current district or station
  const filteredCases = useMemo(() => {
    if (!crimeCases || crimeCases.length === 0) return [];
    
    if (selectedStation) {
      const stationLower = (selectedStation || '').toLowerCase();
      const stationToken = stationLower.replace(/police station|station|checkpoint|beat/gi, '').trim();
      
      const directMatches = crimeCases.filter((c: any) => {
        const loc = (c.location || c.station || '').toLowerCase();
        const desc = (c.description || '').toLowerCase();
        return (stationToken.length >= 3 && (loc.includes(stationToken) || desc.includes(stationToken) || stationToken.includes(loc)))
          || loc.includes(stationLower) || stationLower.includes(loc);
      });

      if (directMatches.length > 0) {
        return directMatches;
      }

      // If no direct station match, look for district sector matches
      if (selectedDistrict) {
        const districtLower = (selectedDistrict || '').toLowerCase();
        const districtToken = districtLower.split(' ')[0].toLowerCase();
        const districtMatches = crimeCases.filter((c: any) => {
          const dist = (c.district || c.location || '').toLowerCase();
          return dist.includes(districtLower) || districtLower.includes(dist) || (districtToken.length >= 3 && dist.includes(districtToken));
        });
        if (districtMatches.length > 0) {
          return districtMatches;
        }
      }
      return [];
    }

    if (selectedDistrict) {
      const districtLower = (selectedDistrict || '').toLowerCase();
      const districtToken = districtLower.split(' ')[0].toLowerCase();
      const districtCode = districtToken.slice(0, 3);
      
      const districtMatches = crimeCases.filter((c: any) => {
        const dist = (c.district || c.location || '').toLowerCase();
        const caseNum = (c.case_number || '').toLowerCase();
        return dist.includes(districtToken) || (districtCode.length >= 3 && caseNum.includes(districtCode));
      });

      if (districtMatches.length > 0) {
        return districtMatches;
      }
      return [];
    }

    return crimeCases.slice(0, 8);
  }, [crimeCases, selectedDistrict, selectedStation]);

  // Selected crime case record
  const activeCrimeCase = useMemo(() => {
    if (!selectedCrimeId) return null;
    return crimeCases.find((c: any) => c.case_number === selectedCrimeId || c.id === selectedCrimeId) || null;
  }, [selectedCrimeId, crimeCases]);

  // Active emerging trends for current district
  const districtEmergingTrends = useMemo(() => {
    if (!selectedDistrict || !emergingTrends.length) return [];
    const topCrime = activeDistrictInfo?.topCrimeType;
    return emergingTrends.filter(t => 
      t.direction === 'increasing' && 
      (t.category === topCrime || t.change_percentage > 25)
    );
  }, [selectedDistrict, emergingTrends, activeDistrictInfo]);

  // Handle zooming of vector view representation on selection
  useEffect(() => {
    if (selectedDistrict) {
      const coords = DISTRICT_COORDS[selectedDistrict];
      if (coords) {
        // Project to canvas coordinates
        const x = projectLonX(coords.lng);
        const y = projectLatY(coords.lat);
        // Center the district at (240, 300) in the left workspace (clear of right drawer)
        const zoom = 1.15;
        setMapZoom(zoom);
        setMapOffset({ 
          x: Math.round(240 - x * zoom), 
          y: Math.round(300 - y * zoom) 
        });
      }
    } else {
      setMapZoom(1);
      setMapOffset({ x: 0, y: 0 });
    }
  }, [selectedDistrict]);

  return (
    <div className="w-full h-full min-h-[580px] relative overflow-hidden flex flex-col justify-between bg-[var(--bg-surface)] rounded-card border border-border-color">
      
      {/* MAP HEADER PANELS */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 max-w-xs pointer-events-none select-none">
        <div className="px-3 py-2 bg-secondary-bg/95 backdrop-blur-md border border-border-color rounded-card pointer-events-auto">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-mono text-[var(--accent-teal)] uppercase font-bold tracking-wider">
              Vector Grid Telemetry
            </span>
            <span className="text-[8.5px] font-mono text-[var(--accent-coral)] font-bold uppercase flex items-center gap-1">
              <Radio className="w-2.5 h-2.5 animate-pulse" />
              LIVE
            </span>
          </div>
          <h3 className="text-[13px] font-mono font-bold text-[var(--text-primary)] mt-0.5 truncate">
            {selectedCrimeId 
              ? `Case: ${selectedCrimeId}` 
              : selectedStation 
              ? `Station: ${selectedStation}` 
              : selectedDistrict 
              ? `District: ${selectedDistrict}` 
              : 'Statewide Overview'}
          </h3>
          <div className="mt-1 flex items-center gap-1.5 text-[8.5px] font-mono text-[var(--text-muted)]">
            <Clock className="w-3 h-3 text-[var(--accent-blue)]" />
            <span className="text-[var(--accent-blue)] font-semibold">{temporalShiftInfo.label}</span>
          </div>
          <p className="text-[8px] font-mono text-[var(--text-secondary)] mt-0.5">
            {temporalShiftInfo.status} &bull; Factor: {temporalShiftInfo.multiplier}x
          </p>
        </div>

        {/* LAYER SELECTORS — collapsible */}
        <div className="px-3 py-2 bg-secondary-bg/95 backdrop-blur-md border border-border-color rounded-card pointer-events-auto flex flex-col gap-1.5">
          <button
            onClick={() => setLayersOpen(v => !v)}
            className="flex items-center justify-between gap-2 cursor-pointer w-full"
          >
            <span className="text-[8px] font-mono uppercase tracking-widest text-[var(--text-muted)]">
              Display Layers
            </span>
            {layersOpen
              ? <ChevronUp className="w-3 h-3 text-[var(--text-muted)]" />
              : <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
            }
          </button>

          {layersOpen && (
            <>
              <button
                onClick={() => toggleLayer('hotspot')}
                className={`w-full py-1 px-2.5 rounded text-[9.5px] font-mono uppercase flex items-center justify-between transition-colors border cursor-pointer ${
                  layers.hotspot 
                    ? 'bg-[var(--accent-blue)]/15 border-[var(--accent-blue)] text-[var(--accent-blue)]' 
                    : 'bg-transparent border-[var(--border-secondary)] text-[var(--text-secondary)]'
                }`}
              >
                <span>Hotspots Data</span>
                <div className={`w-1.5 h-1.5 rounded-full ${layers.hotspot ? 'bg-[var(--accent-blue)] animate-pulse' : 'bg-[var(--text-muted)]'}`} />
              </button>
              
              <button
                onClick={() => toggleLayer('beatCoverage')}
                className={`w-full py-1 px-2.5 rounded text-[9.5px] font-mono uppercase flex items-center justify-between transition-colors border cursor-pointer ${
                  layers.beatCoverage 
                    ? 'bg-[var(--accent-teal)]/15 border-[var(--accent-teal)] text-[var(--accent-teal)]' 
                    : 'bg-transparent border-[var(--border-secondary)] text-[var(--text-secondary)]'
                }`}
              >
                <span>Beat Officer Ratio</span>
                <div className={`w-1.5 h-1.5 rounded-full ${layers.beatCoverage ? 'bg-[var(--accent-teal)] animate-pulse' : 'bg-[var(--text-muted)]'}`} />
              </button>
              
              <button
                onClick={() => toggleLayer('riskScore')}
                className={`w-full py-1 px-2.5 rounded text-[9.5px] font-mono uppercase flex items-center justify-between transition-colors border cursor-pointer ${
                  layers.riskScore 
                    ? 'bg-[var(--accent-purple)]/15 border-[var(--accent-purple)] text-[var(--accent-purple)]' 
                    : 'bg-transparent border-[var(--border-secondary)] text-[var(--text-secondary)]'
                }`}
              >
                <span>Regional Risk Index</span>
                <div className={`w-1.5 h-1.5 rounded-full ${layers.riskScore ? 'bg-[var(--accent-purple)] animate-pulse' : 'bg-[var(--text-muted)]'}`} />
              </button>

              <button
                onClick={() => toggleLayer('socioEconomic')}
                className={`w-full py-1 px-2.5 rounded text-[9.5px] font-mono uppercase flex items-center justify-between transition-colors border cursor-pointer ${
                  layers.socioEconomic
                    ? 'bg-amber-500/15 border-amber-500 text-amber-400'
                    : 'bg-transparent border-[var(--border-secondary)] text-[var(--text-secondary)]'
                }`}
              >
                <span>Socio-Economic Layer</span>
                <div className={`w-1.5 h-1.5 rounded-full ${layers.socioEconomic ? 'bg-amber-400 animate-pulse' : 'bg-[var(--text-muted)]'}`} />
              </button>

              {layers.socioEconomic && (
                <div className="grid grid-cols-2 gap-1 pl-1">
                  {SOCIO_INDICATORS.map((indicator) => (
                    <button
                      key={indicator.key}
                      onClick={() => setSocioIndicator(indicator.key)}
                      className={`py-0.5 px-1.5 rounded text-[8px] font-mono uppercase transition-colors border cursor-pointer ${
                        socioIndicator === indicator.key
                          ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                          : 'bg-transparent border-border-color text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                      }`}
                    >
                      {indicator.label}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* RENDER CANVAS CONTAINER */}
      <div className="flex-1 w-full min-h-[460px] relative cursor-grab active:cursor-grabbing overflow-hidden" style={{ backgroundColor: map.bg }}>

        {/* GEODESIC BACKGROUND GRID */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke={map.grid} strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#gridPattern)" />
        </svg>

        {/* INTERACTIVE VECTOR GRAPHICS */}
        <svg 
          viewBox="0 0 800 600" 
          className="w-full h-full select-none"
        >
          <defs>
            <radialGradient id="hsGlowRed" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#EF4444" stopOpacity="0.55" />
              <stop offset="50%" stopColor="#EF4444" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="hsGlowAmber" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.55" />
              <stop offset="50%" stopColor="#F59E0B" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="hsGlowTeal" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.55" />
              <stop offset="50%" stopColor="#10B981" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="hsGlowCyan" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#00F0FF" stopOpacity="0.65" />
              <stop offset="50%" stopColor="#00F0FF" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#00F0FF" stopOpacity="0" />
            </radialGradient>
            <filter id="hsNeonGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#EF4444" floodOpacity="0.75" />
            </filter>
            <filter id="hsCyanGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#00F0FF" floodOpacity="0.85" />
            </filter>
          </defs>

          {/* Inner transformation group */}
          <g
            style={{
              transform: `translate(${mapOffset.x}px, ${mapOffset.y}px) scale(${mapZoom})`,
              transition: 'transform 600ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Geodesic coordinates lines */}
            <g stroke={map.graticule} strokeWidth="0.5" strokeDasharray="3 3">
              {[74, 75, 76, 77, 78].map((lon) => (
                <line 
                  key={lon} 
                  x1={projectLonX(lon)} 
                  y1={0} 
                  x2={projectLonX(lon)} 
                  y2={600} 
                />
              ))}
              {[12, 13, 14, 15, 16, 17, 18].map((lat) => (
                <line 
                  key={lat} 
                  x1={0} 
                  y1={projectLatY(lat)} 
                  x2={800} 
                  y2={projectLatY(lat)} 
                />
              ))}
            </g>

            {/* District boundary shapes polygons */}
            <g>
            {Object.entries(DISTRICT_BOUNDARIES).map(([name, points]) => {
              const projectedPoints = points.map(([lon, lat]) => `${projectLonX(lon)},${projectLatY(lat)}`).join(' ');
              const isSelected = selectedDistrict === name;
              const info = resolvedDistrictData[name];
              const socio = socioEconomicMap[name];
              const isSpikedDistrict = info?.weeklyTrend === 'up';
              
              // Color coding based on active layers & trend spikes
              let fill = isSpikedDistrict ? 'rgba(239, 68, 68, 0.10)' : map.districtFill;
              let stroke = isSpikedDistrict ? '#EF4444' : map.boundary;
              
              if (layers.socioEconomic && socio) {
                const shade = socioDistrictShade(socio);
                if (shade) {
                  fill = shade.fill;
                  stroke = shade.stroke;
                }
              } else if (layers.riskScore && info && info.riskScore != null) {
                const rs = info.riskScore;
                fill = rs >= 80
                  ? `rgba(217, 52, 20, ${theme === 'dark' ? 0.35 : 0.28})`
                  : rs >= 60
                  ? `rgba(181, 110, 7, ${theme === 'dark' ? 0.35 : 0.30})`
                  : `rgba(13, 122, 91, ${theme === 'dark' ? 0.25 : 0.22})`;
              } else if (layers.beatCoverage && info) {
                const br = info.beatRatio;
                fill = br >= 75
                  ? theme === 'dark' ? 'rgba(20, 201, 151, 0.30)' : 'rgba(5, 150, 105, 0.26)'
                  : br >= 60
                  ? theme === 'dark' ? 'rgba(61, 138, 240, 0.25)' : 'rgba(37, 99, 235, 0.20)'
                  : theme === 'dark' ? 'rgba(240, 156, 46, 0.25)' : 'rgba(217, 119, 6, 0.24)';
              }

              if (isSelected) {
                fill = isSpikedDistrict ? 'rgba(239, 68, 68, 0.18)' : map.districtSelected;
                stroke = isSpikedDistrict ? '#EF4444' : map.boundaryHover;
              }

              return (
                <polygon
                  key={name}
                  points={projectedPoints}
                  className={`transition-all duration-300 cursor-pointer ${isSpikedDistrict ? 'stroke-dasharray-2' : ''}`}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={isSelected ? 2.25 : isSpikedDistrict ? 1.5 : 1.25}
                  strokeDasharray={isSpikedDistrict ? '4 2' : undefined}
                  onMouseEnter={(e) => { if (!isSelected && !isSpikedDistrict) { e.currentTarget.style.fill = map.districtSelected; e.currentTarget.style.stroke = map.boundaryHover; } }}
                  onMouseLeave={(e) => { e.currentTarget.style.fill = fill; e.currentTarget.style.stroke = stroke; }}
                  onClick={() => {
                    if (isSelected) {
                      setSelectedDistrict(null);
                      setSelectedStation(null);
                      setSelectedCrimeId(null);
                      setPanelOpen(false);
                    } else {
                      setSelectedDistrict(name);
                      setSelectedStation(null);
                      setSelectedCrimeId(null);
                      setPanelOpen(true);
                    }
                  }}
                />
              );
            })}
          </g>

          {/* DISTRICT ANCHORS LABELS */}
          <g>
            {Object.entries(DISTRICT_COORDS).map(([name, coords]) => {
              const x = projectLonX(coords.lng);
              const y = projectLatY(coords.lat);
              const isSelected = selectedDistrict === name;
              const info = resolvedDistrictData[name];
              const isSpiked = info?.weeklyTrend === 'up';

              return (
                <g key={name} className="pointer-events-none select-none">
                  {/* Center pin node */}
                  <circle
                    cx={x}
                    cy={y}
                    r={isSelected ? 4 : isSpiked ? 3 : 2.4}
                    fill={isSelected ? map.boundaryHover : isSpiked ? '#EF4444' : map.anchor}
                  />
                  {/* District text tag with protective backdrop pill to avoid blending */}
                  <rect
                    x={x + 4}
                    y={y - 7}
                    width={name.length * 6.2 + (isSpiked ? 22 : 12)}
                    height={14}
                    rx={3}
                    fill={map.bg}
                    fillOpacity={0.75}
                  />
                  <text
                    x={x + 7}
                    y={y + 3.5}
                    className={`font-mono text-[8.5px] ${isSpiked ? 'font-bold' : 'font-semibold'}`}
                    fill={isSpiked ? '#EF4444' : map.label}
                    opacity={isSelected || isSpiked ? 1 : 0.85}
                  >
                    {name} {isSpiked ? '⚠️' : ''} {layers.beatCoverage && info?.beatRatio != null ? `(${info.beatRatio}%)` : ''}
                  </text>
                </g>
              );
            })}
          </g>

          {/* HOTSPOT PULSING RING LAYERS TIED TO TREND SPIKES & TEMPORAL MULTIPLIERS */}
          {layers.hotspot && (
            <g>
              {renderedHotspots.map((hs: any, index: number) => {
                const x = projectLonX(hs.lng);
                const y = projectLatY(hs.lat);
                const isHigh = hs.weight >= 80;
                const isStationSelected = selectedStation === hs.name;
                const isSpikeTrend = hs.trend === 'up' || hs.weight >= 80;
                
                // Color mapping: Red Alert if spiked trend or threat score >= 80
                const color = isSpikeTrend ? '#EF4444' : isHigh ? map.hotspotHigh : hs.weight >= 65 ? map.hotspotMedium : map.hotspotLow;
                const isSelected = (selectedHotspot && selectedHotspot.name === hs.name) || isStationSelected;

                return (
                  <g 
                    key={index} 
                    className="cursor-pointer" 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setSelectedHotspot(hs); 
                      if (hs.district_id) setSelectedDistrict(hs.district_id);
                      setSelectedStation(hs.name);
                      setSelectedCrimeId(null);
                    }}
                  >
                    {/* RED-ZONE PULSING RINGS FOR ACTIVE TREND SPIKES */}
                    {isSpikeTrend && (
                      <>
                        <circle 
                          cx={x} 
                          cy={y} 
                          r={Math.round(20 * temporalShiftInfo.multiplier)} 
                          fill="#EF4444" 
                          opacity={0.25} 
                          className="animate-ping" 
                          pointerEvents="none"
                          style={{ transformOrigin: `${x}px ${y}px`, animationDuration: '0.8s' }} 
                        />
                        <circle 
                          cx={x} 
                          cy={y} 
                          r={Math.round(36 * temporalShiftInfo.multiplier)} 
                          stroke="#EF4444" 
                          strokeWidth="1.5" 
                          strokeDasharray="3 3" 
                          fill="none" 
                          opacity={0.35} 
                          className="animate-ping" 
                          pointerEvents="none"
                          style={{ transformOrigin: `${x}px ${y}px`, animationDuration: '1.2s' }} 
                        />
                      </>
                    )}

                    {/* Standard Concentric pulsing rings modulated by temporal shift */}
                    <circle 
                      cx={x} 
                      cy={y} 
                      r={Math.round(14 * temporalShiftInfo.multiplier)} 
                      fill={color} 
                      opacity={map.haloOpacity} 
                      className="animate-ping" 
                      pointerEvents="none"
                      style={{ transformOrigin: `${x}px ${y}px`, animationDuration: `${Math.max(1.0, 3 - hs.weight / 40)}s` }} 
                    />
                    <circle 
                      cx={x} 
                      cy={y} 
                      r={Math.round(28 * temporalShiftInfo.multiplier)} 
                      stroke={color} 
                      strokeWidth="1" 
                      fill="none" 
                      opacity={map.haloOpacity * 0.6} 
                      className="animate-ping" 
                      pointerEvents="none"
                      style={{ transformOrigin: `${x}px ${y}px`, animationDuration: `${Math.max(1.8, 4.5 - hs.weight / 30)}s` }} 
                    />
                    
                    {/* Center Core dot */}
                    <circle cx={x} cy={y} r={isSpikeTrend || isHigh || isSelected ? 8.5 : 7} fill={map.bg} pointerEvents="none" />
                    <circle cx={x} cy={y} r={isSpikeTrend || isHigh || isSelected ? 6 : 4.5} fill={isSelected ? '#00F0FF' : color} stroke={map.bg} strokeWidth="1.5" pointerEvents="none" />
                    <circle cx={x} cy={y} r={isSpikeTrend || isHigh || isSelected ? 9.5 : 8} stroke={isSelected ? '#00F0FF' : color} strokeWidth="1.25" fill="none" opacity={0.8} pointerEvents="none" />

                    {/* Dedicated crisp hit target circle - only this captures clicks */}
                    <circle cx={x} cy={y} r={11} fill="transparent" />
                  </g>
                );
              })}

              {/* TOP-LEVEL TACTICAL CALLOUT BADGE (Strictly on top of all nodes to prevent collision/obscuring) */}
              {activeTargetHotspot && (() => {
                const tx = projectLonX(activeTargetHotspot.lng);
                const ty = projectLatY(activeTargetHotspot.lat);
                const isHigh = (activeTargetHotspot.weight || 0) >= 80;
                const isSpike = activeTargetHotspot.trend === 'up' || isHigh;
                const badgeColor = isSpike ? '#EF4444' : isHigh ? map.hotspotHigh : (activeTargetHotspot.weight || 0) >= 65 ? map.hotspotMedium : map.hotspotLow;
                const rawName = activeTargetHotspot.name || 'Station';
                const displayName = rawName.replace(/police station/i, 'PS');
                const badgeWidth = Math.max(120, displayName.length * 6.8 + 44);

                return (
                  <g className="pointer-events-none select-none">
                    {/* Vertical Reticle Line pointing to the node center */}
                    <line 
                      x1={tx} 
                      y1={ty - 10} 
                      x2={tx} 
                      y2={ty - 22} 
                      stroke={badgeColor} 
                      strokeWidth="1.5" 
                      strokeDasharray="2 2" 
                    />
                    {/* Glow Shadow & Background pill */}
                    <rect
                      x={tx - badgeWidth / 2}
                      y={ty - 44}
                      width={badgeWidth}
                      height={22}
                      rx={5}
                      fill="rgba(11, 18, 32, 0.96)"
                      stroke={badgeColor}
                      strokeWidth="1.5"
                      filter="drop-shadow(0 4px 12px rgba(0,0,0,0.7))"
                    />
                    {/* Badge Text */}
                    <text
                      x={tx}
                      y={ty - 29.5}
                      textAnchor="middle"
                      className="font-mono text-[9px] font-bold fill-white"
                    >
                      {isSpike ? '🔥 ' : ''}{displayName} &bull; <tspan fill={badgeColor} fontWeight="bold">{activeTargetHotspot.weight}%</tspan>
                    </text>
                  </g>
                );
              })()}
            </g>
          )}
          </g>
        </svg>

        {/* SOCIO-ECONOMIC OVERLAY LEGEND */}
        {layers.socioEconomic && (
          <div className="absolute bottom-4 right-4 z-20 px-3 py-2 bg-[var(--bg-secondary)]/85 border border-border-color rounded-card backdrop-blur-sm pointer-events-none select-none">
            <div className="text-[8px] font-mono uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
              Overlay: {SOCIO_INDICATORS.find((i) => i.key === socioIndicator)?.label}
              {socioIndicatorRange ? ` (${socioIndicatorRange.min}–${socioIndicatorRange.max}${SOCIO_INDICATORS.find((i) => i.key === socioIndicator)?.unit})` : ''}
            </div>
            {socioIndicator === 'urbanization' || !socioIndicatorRange ? (
              <div className="flex flex-col gap-1 text-[8px] font-mono">
                <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm" style={{ background: 'rgba(201, 74, 42, 0.55)' }} /> Urban</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm" style={{ background: 'rgba(212, 130, 10, 0.5)' }} /> Semi-Urban</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm" style={{ background: 'rgba(30, 111, 217, 0.4)' }} /> Rural</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-[8px] font-mono">LOW</span>
                <div className="w-24 h-2 rounded-sm" style={{ background: 'linear-gradient(90deg, rgba(30,111,217,0.25), rgba(212,130,10,0.6), rgba(201,74,42,0.75))' }} />
                <span className="text-[8px] font-mono">HIGH</span>
              </div>
            )}
          </div>
        )}

        {/* MAP INFO RESET SELECTOR */}
        {(selectedDistrict || selectedStation || selectedCrimeId || selectedHotspot) && (
          <button
            onClick={() => {
              setSelectedDistrict(null);
              setSelectedStation(null);
              setSelectedCrimeId(null);
              setSelectedHotspot(null);
              setPanelOpen(false);
            }}
            className="absolute bottom-4 left-4 z-20 px-3 py-1.5 bg-[var(--accent-coral)] hover:opacity-90 text-white font-medium text-xs rounded-md flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Reset View to Statewide</span>
          </button>
        )}
        {/* NON-OBSTRUCTIVE FLOATING SURGE / HOTSPOT ALERT CARD OVERLAY */}
        <AnimatePresence>
          {selectedHotspot && !panelOpen && (() => {
            const hs = selectedHotspot;
            const isHigh = (hs.weight || 0) >= 80;
            const catLower = (hs.type || hs.category || '').toLowerCase();
            const isSpikeTrend = hs.trend === 'up' || emergingTrends.some(t => t.direction === 'increasing' && t.change_percentage > 10 && catLower.includes(t.category.toLowerCase()));
            const color = isSpikeTrend ? '#EF4444' : isHigh ? map.hotspotHigh : (hs.weight || 0) >= 65 ? map.hotspotMedium : map.hotspotLow;

            return (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.96 }}
                transition={{ duration: 0.2 }}
                className="absolute top-4 right-4 z-20 w-72 sm:w-80 max-w-[calc(100%-2rem)] max-h-[calc(100%-4rem)] flex flex-col rounded-card border font-mono text-xs shadow-2xl backdrop-blur-md overflow-hidden select-none"
                style={{
                  backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.96)',
                  borderColor: isSpikeTrend ? 'rgba(239, 68, 68, 0.5)' : color,
                  boxShadow: isSpikeTrend ? '0 12px 30px -4px rgba(239, 68, 68, 0.28)' : '0 12px 30px -4px rgba(0, 0, 0, 0.35)'
                }}
              >
                {/* Header */}
                <div className="flex justify-between items-center px-3.5 py-2.5 border-b border-border-color/60 bg-white/5 shrink-0">
                  <span className="font-bold uppercase text-[10px] flex items-center gap-1.5" style={{ color: isSpikeTrend ? '#EF4444' : color }}>
                    {isSpikeTrend ? <Flame className="w-3.5 h-3.5 animate-pulse text-red-500" /> : <Shield className="w-3.5 h-3.5" />}
                    {isSpikeTrend ? 'Emerging Surge Alert' : 'Hotspot Intelligence'}
                  </span>
                  <button
                    onClick={() => setSelectedHotspot(null)}
                    className="p-1 rounded hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                    title="Dismiss alert"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Body Details */}
                <div className="p-3.5 space-y-2 text-[10px] overflow-y-auto flex-1">
                  <div>
                    <span className="text-[8px] uppercase tracking-wider text-[var(--text-muted)] block font-bold">Police Station</span>
                    <p className="font-bold text-xs uppercase text-[var(--text-primary)] leading-tight mt-0.5">{hs.name}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="p-2 rounded bg-[var(--bg-secondary)]/50 border border-border-color/40">
                      <span className="text-[8px] text-[var(--text-muted)] uppercase block">Sector</span>
                      <span className="font-bold text-[10px] text-[var(--text-secondary)]">{hs.district_id || selectedDistrict || 'Statewide'}</span>
                    </div>
                    <div className="p-2 rounded bg-[var(--bg-secondary)]/50 border border-border-color/40">
                      <span className="text-[8px] text-[var(--text-muted)] uppercase block">Threat Index</span>
                      <span className="font-bold text-[10px]" style={{ color }}>{hs.weight}% {hs.trend === 'up' ? '▲ Surging' : ''}</span>
                    </div>
                  </div>

                  <div className="p-2 rounded bg-[var(--bg-secondary)]/50 border border-border-color/40">
                    <span className="text-[8px] text-[var(--text-muted)] uppercase block">Primary Category</span>
                    <span className="font-bold text-[10px] text-orange-400">{hs.type || hs.category || 'Incident Hotspot'}</span>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="p-3 pt-0 shrink-0">
                  <button
                    onClick={() => {
                      if (hs.district_id) setSelectedDistrict(hs.district_id);
                      setSelectedStation(hs.name);
                      setSelectedCrimeId(null);
                      setPanelOpen(true);
                    }}
                    className="w-full py-2 px-3 text-[10px] uppercase font-bold text-white bg-[#1E6FD9] hover:bg-[#1E6FD9]/85 active:scale-[0.98] rounded-md transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <span>View Full Intelligence Dossier</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            );
          })()}
        </AnimatePresence>
      </div>

      {/* 3-TIER DRILL-DOWN DETAILS PANEL DRAWER SLIDING IN (RIGHT SIDE) */}
      <AnimatePresence>
        {panelOpen && (activeDistrictInfo || activeStationInfo || selectedDistrict) && (
          <motion.div
            initial={{ x: 380, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 380, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 100 }}
            className="absolute top-0 right-0 h-full w-84 md:w-96 bg-secondary-bg/95 border-l border-border-color backdrop-blur-md z-30 flex flex-col overflow-hidden select-none shadow-2xl"
          >
            {/* INTERACTIVE BREADCRUMB HEADER (STICKY) */}
            <div className="p-4 pb-3 border-b border-border-color shrink-0 bg-secondary-bg/95 backdrop-blur-md">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase font-bold text-[var(--accent-teal)]">
                  <Shield className="w-3.5 h-3.5 text-[var(--accent-blue)] shrink-0" />
                  <span>SCRB Intelligence Drill-Down</span>
                </div>
                <button
                  onClick={() => setPanelOpen(false)}
                  className="p-1 hover:bg-[var(--accent-blue)]/15 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Breadcrumb Steps */}
              <div className="flex items-center gap-1 text-[9px] font-mono flex-wrap">
                <button
                  onClick={() => {
                    setSelectedDistrict(null);
                    setSelectedStation(null);
                    setSelectedCrimeId(null);
                  }}
                  className="text-[var(--text-muted)] hover:text-[var(--accent-blue)] cursor-pointer underline"
                >
                  Statewide
                </button>

                {selectedDistrict && (
                  <>
                    <ChevronRight className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
                    <button
                      onClick={() => {
                        setSelectedStation(null);
                        setSelectedCrimeId(null);
                      }}
                      className={`cursor-pointer ${!selectedStation && !selectedCrimeId ? 'text-[var(--accent-blue)] font-bold' : 'text-[var(--text-muted)] hover:text-[var(--accent-blue)] underline'}`}
                    >
                      {selectedDistrict}
                    </button>
                  </>
                )}

                {selectedStation && (
                  <>
                    <ChevronRight className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
                    <button
                      onClick={() => setSelectedCrimeId(null)}
                      className={`cursor-pointer max-w-[110px] truncate ${!selectedCrimeId ? 'text-[var(--accent-blue)] font-bold' : 'text-[var(--text-muted)] hover:text-[var(--accent-blue)] underline'}`}
                      title={selectedStation}
                    >
                      {selectedStation}
                    </button>
                  </>
                )}

                {selectedCrimeId && (
                  <>
                    <ChevronRight className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
                    <span className="text-orange-400 font-bold max-w-[90px] truncate" title={selectedCrimeId}>
                      {selectedCrimeId}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* SCROLLABLE INTEL CONTENT BODY */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pr-3.5">
              
              {/* TIER 3: CRIME CASE VIEW */}
              {activeCrimeCase ? (
                <div className="space-y-3 font-mono text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[8.5px] uppercase font-bold text-[var(--accent-coral)] flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" />
                      Incident Case Dossier
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${
                      activeCrimeCase.priority === 'high' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {activeCrimeCase.priority || 'Medium'} Priority
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-[var(--text-primary)] uppercase">
                    {activeCrimeCase.case_number}
                  </h4>

                  <div className="p-3 bg-[var(--bg-primary)]/80 rounded border border-border-color space-y-2 text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Crime Category:</span>
                      <span className="text-[var(--text-primary)] font-semibold">{activeCrimeCase.crime_type || activeCrimeCase.category || 'IPC Section Violation'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Occurred At:</span>
                      <span className="text-[var(--text-secondary)]">{activeCrimeCase.time ? new Date(activeCrimeCase.time).toLocaleString() : 'Recent Incident'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Status:</span>
                      <span className="text-emerald-400 font-bold uppercase">{activeCrimeCase.status || 'Active Investigation'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Jurisdiction:</span>
                      <span className="text-[var(--text-secondary)]">{activeCrimeCase.location || selectedStation || selectedDistrict}</span>
                    </div>
                  </div>

                  {activeCrimeCase.description && (
                    <div className="p-3 bg-[var(--bg-primary)]/40 rounded border border-[var(--border-primary)]">
                      <span className="text-[8px] uppercase text-[var(--text-muted)] font-bold block mb-1">Case Summary / MO Details</span>
                      <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">{activeCrimeCase.description}</p>
                    </div>
                  )}

                  <button
                    onClick={() => setSelectedCrimeId(null)}
                    className="w-full py-1.5 text-[9.5px] uppercase font-bold text-[var(--accent-blue)] bg-[var(--accent-blue)]/10 hover:bg-[var(--accent-blue)]/20 border border-[var(--accent-blue)]/30 rounded cursor-pointer transition-colors"
                  >
                    &larr; Back to Station Cases
                  </button>
                </div>
              ) : activeStationInfo ? (
                /* TIER 2: POLICE STATION VIEW */
                <div className="space-y-4 font-mono text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[8px] font-bold text-[var(--accent-teal)] uppercase tracking-wider block">
                        Police Station Jurisdiction
                      </span>
                      <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase">
                        {activeStationInfo.name}
                      </h3>
                    </div>
                    <div className={`px-2.5 py-1 rounded font-bold text-[10px] ${
                      !activeStationInfo.hasLiveIntelligence
                        ? 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                        : activeStationInfo.weight >= 75 ? 'bg-red-500/15 text-red-400 border border-red-500/30' : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    }`}>
                      {activeStationInfo.hasLiveIntelligence ? `${activeStationInfo.weight}% Risk` : 'No live data'}
                    </div>
                  </div>

                  <div className="p-3 bg-[var(--bg-primary)]/80 rounded border border-border-color space-y-1.5 text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">District Sector:</span>
                      <span className="text-[var(--text-primary)] font-bold">{activeStationInfo.district_id}</span>
                    </div>
                    {activeStationInfo.hasLiveIntelligence ? (
                      <>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Primary Crime:</span>
                      <span className="text-orange-400 font-semibold">{activeStationInfo.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Station Coordinates:</span>
                      <span className="text-[var(--text-secondary)]">{activeStationInfo.lat.toFixed(3)}°N, {activeStationInfo.lng.toFixed(3)}°E</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Weekly Trend:</span>
                      <span className={`font-bold flex items-center gap-1 ${activeStationInfo.trend === 'up' ? 'text-red-400' : 'text-emerald-400'}`}>
                        {activeStationInfo.trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {activeStationInfo.trend === 'up' ? 'SURGING' : 'STABILIZED'}
                      </span>
                    </div>
                      </>
                    ) : (
                      <>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Station Coordinates:</span>
                      <span className="text-[var(--text-secondary)]">{activeStationInfo.lat.toFixed(3)}°N, {activeStationInfo.lng.toFixed(3)}°E</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Intelligence:</span>
                      <span className="text-[var(--text-muted)] font-semibold">No live hotspot data for this station</span>
                    </div>
                      </>
                    )}
                  </div>

                  {/* Crime Incidents under Station */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[9px] font-bold text-[var(--text-primary)] uppercase tracking-wider">
                        Registered Incidents & Cases ({filteredCases.length})
                      </span>
                      <span className="text-[8px] text-[var(--text-muted)]">Click case to view</span>
                    </div>
                    
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {filteredCases.length > 0 ? (
                        filteredCases.map((c: any) => (
                          <div
                            key={c.case_number || c.id}
                            onClick={() => setSelectedCrimeId(c.case_number || c.id)}
                            className="p-2 bg-[var(--bg-primary)] hover:bg-[var(--accent-blue)]/10 border border-border-color hover:border-[var(--accent-blue)]/40 rounded cursor-pointer transition-all flex items-center justify-between"
                          >
                            <div>
                              <p className="font-bold text-[9.5px] text-[var(--text-primary)] uppercase truncate">{c.case_number}</p>
                              <p className="text-[8px] text-[var(--text-muted)] truncate">{c.crime_type || c.category || 'Incident'}</p>
                            </div>
                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                              c.priority === 'high' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
                            }`}>
                              {c.priority || 'MED'}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="p-3 text-center text-[9px] text-[var(--text-muted)] bg-[var(--bg-primary)]/40 rounded border border-dashed border-border-color">
                          No direct FIR filings logged under this station.
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedStation(null);
                      setSelectedCrimeId(null);
                    }}
                    className="w-full py-1.5 text-[9.5px] uppercase font-bold text-[var(--accent-blue)] bg-[var(--accent-blue)]/10 hover:bg-[var(--accent-blue)]/20 border border-[var(--accent-blue)]/30 rounded cursor-pointer transition-colors"
                  >
                    &larr; Back to District Overview
                  </button>
                </div>
              ) : activeDistrictInfo ? (
                /* TIER 1: DISTRICT OVERVIEW */
                <div className="space-y-3.5">
                  {/* Risk gauge card — renders only a backend-supplied score;
                      missing model output shows an explicit empty state. */}
                  {activeDistrictInfo.riskScore != null ? (
                    <div className={`p-3.5 rounded-card border flex items-center justify-between ${
                      activeDistrictInfo.riskScore >= 75
                        ? 'bg-[var(--accent-coral)]/5 border-[var(--accent-coral)]/20 text-[var(--accent-coral)]'
                        : 'bg-[var(--accent-teal)]/5 border-[var(--accent-teal)]/20 text-[var(--accent-teal)]'
                    }`}>
                      <div>
                        <span className="text-[9px] font-mono uppercase tracking-widest text-[var(--text-muted)] block">
                          District Threat Score
                        </span>
                        <span className="text-2xl font-mono font-extrabold mt-0.5 block">
                          {activeDistrictInfo.riskScore}/100
                        </span>
                      </div>
                      <div className={`p-2 rounded-full ${
                        activeDistrictInfo.riskScore >= 75 ? 'bg-red-500/10' : 'bg-emerald-500/10'
                      }`}>
                        <AlertTriangle className="w-6 h-6 animate-pulse" />
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-card border border-dashed border-[var(--border-primary)] flex items-center justify-between">
                      <div>
                        <span className="text-[9px] font-mono uppercase tracking-widest text-[var(--text-muted)] block">
                          District Threat Score
                        </span>
                        <span className="text-sm font-mono font-bold mt-0.5 block text-[var(--text-muted)]">
                          No backend risk model output for this district yet.
                        </span>
                      </div>
                      <AlertTriangle className="w-5 h-5 text-[var(--text-disabled)]" />
                    </div>
                  )}

                  {/* Emerging Trend Alert Banner */}
                  {districtEmergingTrends.length > 0 && (
                    <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <div className="flex items-center gap-1.5 text-[9px] font-mono font-bold text-red-400 uppercase">
                        <Flame className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                        <span>Emerging Trend Alert</span>
                      </div>
                      <p className="text-[9px] font-mono text-[var(--text-primary)] mt-1 font-semibold">
                        {districtEmergingTrends[0].category}: +{districtEmergingTrends[0].change_percentage}% surge
                      </p>
                      <p className="text-[8px] font-mono text-[var(--text-muted)] mt-0.5">
                        {districtEmergingTrends[0].recent_count} recent vs {districtEmergingTrends[0].historical_count} historical baseline
                      </p>
                    </div>
                  )}

                  {/* POLICE STATION JURISDICTION SELECTOR DROPDOWN & LIST */}
                  <div className="p-3 bg-[var(--bg-primary)] border border-[var(--accent-blue)]/40 rounded-card font-mono space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9.5px] font-bold text-[var(--accent-teal)] uppercase tracking-wider flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
                        Police Station Jurisdictions ({districtStations.length})
                      </span>
                      <span className="text-[8px] text-[var(--text-muted)]">Select station to filter</span>
                    </div>

                    {/* Compact quick-jump dropdown */}
                    <div className="relative">
                      <select
                        value={selectedStation || ''}
                        onChange={(e) => {
                          if (e.target.value) {
                            setSelectedStation(e.target.value);
                            setSelectedCrimeId(null);
                          } else {
                            setSelectedStation(null);
                          }
                        }}
                        className="w-full px-2.5 py-1.5 bg-secondary-bg border border-border-color rounded text-[10px] text-[var(--text-primary)] font-mono appearance-none cursor-pointer focus:outline-none focus:border-[var(--accent-blue)]"
                      >
                        <option value="">-- Jump to Police Station --</option>
                        {districtStations.map((st: any) => (
                          <option key={st.name} value={st.name}>
                            {st.name}{st.hasLiveIntelligence ? ` (${st.weight}% Risk)` : ''}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)] absolute right-2.5 top-2 pointer-events-none" />
                    </div>

                    {/* Scrollable station cards list */}
                    <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                      {districtStations.map((station) => (
                        <div
                          key={station.name}
                          onClick={() => {
                            setSelectedStation(station.name);
                            setSelectedCrimeId(null);
                          }}
                          className={`p-2 rounded border transition-all cursor-pointer flex items-center justify-between group ${
                            selectedStation === station.name
                              ? 'bg-[var(--accent-blue)]/15 border-[var(--accent-blue)] text-[var(--accent-blue)] font-bold'
                              : 'bg-secondary-bg/60 border-border-color hover:bg-secondary-bg hover:border-[var(--accent-blue)]/50'
                          }`}
                        >
                          <div className="overflow-hidden pr-2">
                            <p className="font-bold text-[9.5px] text-[var(--text-primary)] group-hover:text-[var(--accent-blue)] uppercase truncate">
                              {station.name}
                            </p>
                            <p className="text-[8px] text-[var(--text-muted)] truncate">{station.hasLiveIntelligence ? station.type : 'Reference location'}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {station.hasLiveIntelligence ? (
                              <span className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded ${station.weight >= 75 ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'}`}>
                                {station.weight}%
                              </span>
                            ) : (
                              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)]" title="No live hotspot intelligence returned for this station">
                                No data
                              </span>
                            )}
                            <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--accent-blue)] group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Primary Stats lists — only backend-provided values render;
                      missing metrics show an explicit "No data" state (issue 161). */}
                  <div className="space-y-2 font-mono text-xs pt-1">
                    <div className="flex justify-between py-1 border-b border-[var(--border-primary)]">
                      <span className="text-[var(--text-muted)]">Monthly FIR Total</span>
                      <span className="text-[var(--text-primary)] font-bold">{activeDistrictInfo.crimeCount} filings</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[var(--border-primary)]">
                      <span className="text-[var(--text-muted)]">Beat Coverage Ratio</span>
                      {activeDistrictInfo.beatRatio != null ? (
                        <span className="text-[var(--text-primary)] font-bold" title="Derived from backend risk scores: 100 − district risk. Not a field-verified coverage metric.">{activeDistrictInfo.beatRatio}% estimate</span>
                      ) : (
                        <span className="text-[var(--text-muted)]">No data</span>
                      )}
                    </div>
                    <div className="flex justify-between py-1 border-b border-[var(--border-primary)]">
                      <span className="text-[var(--text-muted)]">Dominant Category</span>
                      <span className="text-orange-400 font-semibold">{activeDistrictInfo.topCrimeType}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[var(--border-primary)] items-center">
                      <span className="text-[var(--text-muted)]">Weekly Trend</span>
                      {/* No invented percentages — the backend hotspot trend flag
                          carries direction only (issue 161 §1). */}
                      {activeDistrictInfo.weeklyTrend === 'up' ? (
                        <span className="text-red-500 font-bold flex items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5" />
                          RISING
                        </span>
                      ) : activeDistrictInfo.weeklyTrend === 'down' ? (
                        <span className="text-emerald-500 font-bold flex items-center gap-1">
                          <TrendingDown className="w-3.5 h-3.5" />
                          DECLINING
                        </span>
                      ) : (
                        <span className="text-blue-400 font-bold">STABILIZED</span>
                      )}
                    </div>
                  </div>

                  {/* REAL SOCIO-ECONOMIC INDICATORS CARD */}
                  {selectedDistrict && socioEconomicMap[selectedDistrict] && (
                    <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-card font-mono space-y-1.5">
                      <div className="flex justify-between items-center text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                        <span>Socio-Economic Profile</span>
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-[8.5px] uppercase">
                          {socioEconomicMap[selectedDistrict].urbanization_type || 'Semi-Urban'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[9.5px] pt-1 text-[var(--text-secondary)]">
                        <div>Literacy: <span className="font-bold text-[var(--text-primary)]">{socioEconomicMap[selectedDistrict].literacy_rate}%</span></div>
                        <div>Density: <span className="font-bold text-[var(--text-primary)]">{socioEconomicMap[selectedDistrict].population_density} /km²</span></div>
                        <div>Avg Income: <span className="font-bold text-[var(--text-primary)]">₹{socioEconomicMap[selectedDistrict].avg_income_lakhs}L</span></div>
                        <div>Crime Rate: <span className="font-bold text-[var(--text-primary)]">{socioEconomicMap[selectedDistrict].crime_per_lakh} /lakh</span></div>
                      </div>
                    </div>
                  )}

                  {/* Actionable recommendation block */}
                  <div className="p-2.5 bg-[var(--bg-secondary)]/40 border border-[var(--border-primary)] rounded-btn font-mono">
                    <span className="text-[8px] font-bold text-[var(--accent-blue)] uppercase tracking-wider block mb-0.5">
                      SCRB Operational Intel
                    </span>
                    <p className="text-[9.5px] leading-relaxed text-[var(--text-secondary)]">
                      Aggregated from active FIR registrations, station clusters, and time-shifted crime telemetry.
                    </p>
                  </div>
                </div>
              ) : selectedDistrict ? (
                /* TIER 1 EMPTY STATE (issue 161): the backend has no records for
                   this district — show an honest empty state instead of invented
                   counts, scores or station names. */
                <div className="space-y-3">
                  <div className="p-4 bg-[var(--bg-primary)]/60 border border-dashed border-[var(--border-primary)] rounded-card text-center">
                    <MapPin className="w-8 h-8 mx-auto mb-2 text-[var(--text-disabled)]" />
                    <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                      No backend intelligence for {selectedDistrict}
                    </p>
                    <p className="text-[9px] font-mono text-[var(--text-muted)] mt-1">
                      The Saksha database currently holds no crime records, stations or analytics for this district. Nothing is fabricated to fill this panel.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedDistrict(null);
                      setSelectedStation(null);
                      setSelectedCrimeId(null);
                    }}
                    className="w-full py-1.5 text-[9.5px] uppercase font-bold text-[var(--accent-blue)] bg-[var(--accent-blue)]/10 hover:bg-[var(--accent-blue)]/20 border border-[var(--accent-blue)]/30 rounded cursor-pointer transition-colors"
                  >
                    &larr; Back to Statewide View
                  </button>
                </div>
              ) : null}

            </div>

            {/* STICKY FOOTER ACTION BAR (ALWAYS FULLY VISIBLE & FITS PERFECTLY IN FRAME) */}
            <div className="p-4 pt-3 border-t border-border-color shrink-0 bg-secondary-bg/95 backdrop-blur-md z-10">
              <button
                onClick={() => {
                  const targetName = activeCrimeCase
                    ? `Case_${activeCrimeCase.case_number}`
                    : activeStationInfo
                    ? `${activeStationInfo.name}_Station`
                    : `${activeDistrictInfo?.name || selectedDistrict || 'Regional'}_District`;

                  const targetData = activeCrimeCase || activeStationInfo || activeDistrictInfo;

                  downloadSecureDossier(
                    `${targetName} SCRB Intelligence Dossier`,
                    targetData,
                    user ? `CONFIDENTIAL - ${user.badgeId}` : 'CONFIDENTIAL - STATE POLICE'
                  );
                  if (user) {
                    addLog(
                      user.name,
                      user.badgeId,
                      'EXPORT',
                      `Exported SCRB intelligence dossier for ${targetName}`
                    );
                  }
                }}
                disabled={!activeCrimeCase && !activeStationInfo && !activeDistrictInfo}
                title={(!activeCrimeCase && !activeStationInfo && !activeDistrictInfo) ? 'No backend intelligence available to export for this selection.' : undefined}
                className={`w-full py-2.5 font-semibold text-[12px] uppercase rounded-md cursor-pointer text-center select-none transition-colors shadow-sm ${
                  (!activeCrimeCase && !activeStationInfo && !activeDistrictInfo)
                    ? 'bg-[var(--bg-tertiary)] text-[var(--text-disabled)] cursor-not-allowed'
                    : 'bg-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/80 text-white'
                }`}
              >
                Export SCRB Dossier (PDF)
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BOTTOM SLIDER */}
      <div className="p-4 z-20">
        <TimeSlider />
      </div>

    </div>
  );
};

export default KarnatakaMap;
