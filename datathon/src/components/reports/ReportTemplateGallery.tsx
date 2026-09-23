import React from 'react';
import {
  FileText,
  MapPin,
  ShieldAlert,
  Network,
  Users,
  Compass,
  FileCheck,
  UserCheck,
  Package,
} from 'lucide-react';
import type { ReportType } from './index';

export interface TemplateDefinition {
  id: ReportType;
  title: string;
  category: 'Tactical' | 'Spatial' | 'Operational' | 'Intelligence' | 'Executive' | 'Forensic';
  description: string;
  icon: React.ReactNode;
  tags: string[];
  recommendedRoles: string[];
}

export const REPORT_TEMPLATES: TemplateDefinition[] = [
  {
    id: 'cases',
    title: 'Crime Incident & Investigation Analysis',
    category: 'Tactical',
    description: 'Detailed breakdown of criminal cases, severity, assigned officers, MO tags, and investigation progress across jurisdictions.',
    icon: <FileText className="w-5 h-5 text-blue-400" />,
    tags: ['FIRs', 'Case Status', 'MO Tags', 'IPC Sections'],
    recommendedRoles: ['IO', 'SCRB', 'INSPECTOR'],
  },
  {
    id: 'hotspots',
    title: 'District Hotspot & Spatial Risk Assessment',
    category: 'Spatial',
    description: 'Geospatial density analysis mapping incident clusters, high-risk coordinates, and police station jurisdictions.',
    icon: <MapPin className="w-5 h-5 text-rose-400" />,
    tags: ['Coordinates', 'Spatial Density', 'Station Areas'],
    recommendedRoles: ['SP', 'SCRB', 'INSPECTOR'],
  },
  {
    id: 'interventions',
    title: 'Operational Interventions & Patrol Surges',
    category: 'Operational',
    description: 'Active police operations, patrol surges, CCTV deployments, estimated coverage metrics, and observed crime displacement.',
    icon: <ShieldAlert className="w-5 h-5 text-amber-400" />,
    tags: ['Patrols', 'Coverage %', 'Outcome Review', 'Stage'],
    recommendedRoles: ['SP', 'INSPECTOR', 'ADMIN'],
  },
  {
    id: 'network',
    title: 'Criminal Syndicate & Network Intelligence',
    category: 'Intelligence',
    description: 'Syndicate linkages, gang affiliations, associate rosters, active warrants, and modus operandi cross-references.',
    icon: <Network className="w-5 h-5 text-purple-400" />,
    tags: ['Gangs', 'Associates', 'Aliases', 'Threat Level'],
    recommendedRoles: ['SCRB', 'IO', 'INSPECTOR'],
  },
  {
    id: 'victimology',
    title: 'Victimology & Demographics Intelligence',
    category: 'Tactical',
    description: 'Demographic incident analysis, age and gender profiles, repeat victim occurrences, and recorded victim statements.',
    icon: <Users className="w-5 h-5 text-teal-400" />,
    tags: ['Demographics', 'Statements', 'Vulnerability'],
    recommendedRoles: ['IO', 'SCRB', 'SP'],
  },
  {
    id: 'strategic',
    title: 'Strategic Command & Executive KPI Brief',
    category: 'Executive',
    description: 'High-level executive briefing summarizing district case loads, priority escalations, clearance rates, and resource allocation.',
    icon: <Compass className="w-5 h-5 text-emerald-400" />,
    tags: ['Command KPIs', 'Clearance Rate', 'Priority Spread'],
    recommendedRoles: ['SP', 'ADMIN', 'SCRB'],
  },
  {
    id: 'dossier',
    title: 'Comprehensive Target & Subject Dossier',
    category: 'Intelligence',
    description: 'Full multi-dimensional intelligence dossier on specific suspects or major case investigations.',
    icon: <FileCheck className="w-5 h-5 text-cyan-400" />,
    tags: ['Deep Profile', 'Unified Timeline', 'Cross-Entity'],
    recommendedRoles: ['IO', 'SCRB', 'INSPECTOR', 'SP'],
  },
  {
    id: 'officers',
    title: 'Officer Deployment & Duty Registry',
    category: 'Operational',
    description: 'Personnel status, rank allocations, active station assignments, and officer workload distribution.',
    icon: <UserCheck className="w-5 h-5 text-sky-400" />,
    tags: ['Personnel', 'Station Assignment', 'Rank', 'Status'],
    recommendedRoles: ['ADMIN', 'SP', 'INSPECTOR'],
  },
  {
    id: 'evidence',
    title: 'Forensic Evidence & Chain of Custody',
    category: 'Forensic',
    description: 'Catalog of seized items, physical/digital evidence chain of custody, storage tracking, and case associations.',
    icon: <Package className="w-5 h-5 text-amber-500" />,
    tags: ['Chain of Custody', 'Storage Path', 'Evidence Type'],
    recommendedRoles: ['IO', 'INSPECTOR', 'ADMIN'],
  },
];

interface ReportTemplateGalleryProps {
  selectedType: ReportType;
  onSelect: (type: ReportType) => void;
  userRole: string;
}

export const ReportTemplateGallery: React.FC<ReportTemplateGalleryProps> = ({
  selectedType,
  onSelect,
  userRole,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
            Intelligence Report Templates
          </h3>
          <p className="text-[11px] text-[var(--text-muted)]">
            Select a verified police intelligence format to configure parameters and generate documents
          </p>
        </div>
        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[var(--bg-secondary)] border border-border-color text-[var(--text-muted)]">
          {REPORT_TEMPLATES.length} Formats Available
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {REPORT_TEMPLATES.map((tmpl) => {
          const isSelected = selectedType === tmpl.id;
          const isRecommended = tmpl.recommendedRoles.includes(userRole);

          return (
            <div
              key={tmpl.id}
              onClick={() => onSelect(tmpl.id)}
              className={`group relative flex flex-col justify-between rounded-xl border p-4 cursor-pointer transition-all duration-200 ${
                isSelected
                  ? 'border-[var(--accent-blue)] bg-[var(--accent-blue)]/10 shadow-[0_0_15px_rgba(59,130,246,0.15)] ring-1 ring-[var(--accent-blue)]/50'
                  : 'border-border-color bg-[var(--bg-secondary)]/70 hover:border-border-color/80 hover:bg-[var(--bg-secondary)]'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`p-2 rounded-lg border ${
                        isSelected
                          ? 'border-[var(--accent-blue)]/40 bg-[var(--accent-blue)]/20'
                          : 'border-border-color bg-[var(--bg-primary)]'
                      }`}
                    >
                      {tmpl.icon}
                    </div>
                    <div>
                      <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-[var(--bg-primary)] border border-border-color text-[var(--text-muted)]">
                        {tmpl.category}
                      </span>
                      {isRecommended && (
                        <span className="ml-1.5 text-[9px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                          Recommended
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <h4 className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-blue)] transition-colors">
                  {tmpl.title}
                </h4>
                <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)] line-clamp-2">
                  {tmpl.description}
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-border-color/50 flex items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1">
                  {tmpl.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--bg-primary)]/80 text-[var(--text-secondary)] font-mono"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider ${
                    isSelected ? 'text-[var(--accent-blue)]' : 'text-[var(--text-muted)] group-hover:text-[var(--text-primary)]'
                  }`}
                >
                  {isSelected ? 'Active' : 'Configure →'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
