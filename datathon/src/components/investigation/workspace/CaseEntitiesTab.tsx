import React, { useState } from 'react';
import {
  Users,
  Car,
  MapPin,
  Building,
  Smartphone,
  ExternalLink,
  Search,
} from 'lucide-react';
import type { InvestigationData } from '../../../services/api';

interface Props {
  data: InvestigationData;
  onSelectCriminal?: (criminalId: string) => void;
}

type SubSection = 'all' | 'persons' | 'vehicles' | 'locations' | 'organizations' | 'digital';

export const CaseEntitiesTab: React.FC<Props> = ({ data, onSelectCriminal }) => {
  const [activeSection, setActiveSection] = useState<SubSection>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const criminals = data.criminals || [];
  const vehicles = data.vehicles || [];
  const locations = data.locations || [];
  const organizations = data.organizations || [];
  const digitalAccounts = data.digital_accounts || [];

  const handleOpenCriminal = (id: string) => {
    if (onSelectCriminal) {
      onSelectCriminal(id);
    } else {
      window.dispatchEvent(
        new CustomEvent('navigate-tab', { detail: { tab: 'criminals', targetId: id } })
      );
    }
  };

  return (
    <div className="space-y-6 text-left">
      {/* Sub-navigation and Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveSection('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeSection === 'all'
                ? 'bg-[var(--accent-teal)] text-slate-950 font-bold'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-primary)]'
            }`}
          >
            All Entities ({criminals.length + vehicles.length + locations.length + organizations.length + digitalAccounts.length})
          </button>
          <button
            onClick={() => setActiveSection('persons')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeSection === 'persons'
                ? 'bg-blue-500 text-white font-bold'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-primary)]'
            }`}
          >
            <Users className="w-3.5 h-3.5" /> Persons ({criminals.length})
          </button>
          <button
            onClick={() => setActiveSection('vehicles')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeSection === 'vehicles'
                ? 'bg-purple-500 text-white font-bold'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-primary)]'
            }`}
          >
            <Car className="w-3.5 h-3.5" /> Vehicles ({vehicles.length})
          </button>
          <button
            onClick={() => setActiveSection('locations')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeSection === 'locations'
                ? 'bg-cyan-500 text-slate-950 font-bold'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-primary)]'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" /> Locations ({locations.length})
          </button>
          <button
            onClick={() => setActiveSection('organizations')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeSection === 'organizations'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-primary)]'
            }`}
          >
            <Building className="w-3.5 h-3.5" /> Gangs / Syndicates ({organizations.length})
          </button>
          <button
            onClick={() => setActiveSection('digital')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeSection === 'digital'
                ? 'bg-emerald-500 text-slate-950 font-bold'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-primary)]'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" /> Digital Leads ({digitalAccounts.length})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search entities..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-teal)]"
          />
        </div>
      </div>

      {/* SECTION 1: Persons of Interest */}
      {(activeSection === 'all' || activeSection === 'persons') && (
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-[var(--border-primary)]/60 pb-2">
            <h3 className="text-xs font-mono uppercase font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              Persons of Interest ({criminals.length})
            </h3>
            <span className="text-[10px] text-[var(--text-muted)] font-mono">ACCUSED & SUSPECTS</span>
          </div>

          {criminals.length === 0 ? (
            <div className="p-6 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl">
              No persons of interest linked to this case record.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {criminals
                .filter((c) => !searchTerm || c.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || (c.aliases && c.aliases.toLowerCase().includes(searchTerm.toLowerCase())))
                .map((criminal) => (
                  <div
                    key={criminal.id}
                    onClick={() => handleOpenCriminal(criminal.id)}
                    className="p-4 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl hover:border-blue-500/50 transition-all cursor-pointer group shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-[var(--text-primary)] group-hover:text-blue-400 transition-colors">
                          {criminal.full_name}
                        </h4>
                        {criminal.aliases && (
                          <div className="text-xs text-[var(--text-muted)] italic">
                            Alias: {criminal.aliases}
                          </div>
                        )}
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-mono uppercase font-bold border ${
                        criminal.risk_score >= 70
                          ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                          : criminal.risk_score >= 40
                          ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      }`}>
                        Risk: {criminal.risk_score}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-[var(--border-primary)]/40 text-xs">
                      <div>
                        <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase">Status</span>
                        <div className="font-semibold uppercase text-[var(--text-primary)]">{criminal.status.replace(/_/g, ' ')}</div>
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase">Linked Cases</span>
                        <div className="font-mono text-[var(--text-secondary)]">{criminal.linked_fir_count} FIRs</div>
                      </div>
                    </div>

                    {criminal.mo_summary && (
                      <p className="text-xs text-[var(--text-secondary)] mt-2.5 pt-2 border-t border-[var(--border-primary)]/20 line-clamp-2 leading-relaxed">
                        {criminal.mo_summary}
                      </p>
                    )}

                    <div className="flex items-center justify-between mt-3 pt-2 text-[10px] text-blue-400 font-medium">
                      <span>View Full Profile</span>
                      <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: Vehicles */}
      {(activeSection === 'all' || activeSection === 'vehicles') && (
        <div className="space-y-3 pt-4">
          <div className="flex items-center justify-between border-b border-[var(--border-primary)]/60 pb-2">
            <h3 className="text-xs font-mono uppercase font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Car className="w-4 h-4 text-purple-400" />
              Identified Vehicles ({vehicles.length})
            </h3>
            <span className="text-[10px] text-[var(--text-muted)] font-mono">GETAWAY & SUSPECT VEHICLES</span>
          </div>

          {vehicles.length === 0 ? (
            <div className="p-6 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl">
              No vehicles recorded or extracted for this investigation.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vehicles
                .filter((v) => !searchTerm || v.registration.toLowerCase().includes(searchTerm.toLowerCase()) || (v.make_model && v.make_model.toLowerCase().includes(searchTerm.toLowerCase())))
                .map((vehicle) => (
                  <div key={vehicle.id} className="p-4 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="font-mono font-black text-sm px-2.5 py-1 rounded bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--accent-teal)]">
                        {vehicle.registration}
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-bold uppercase">
                        {vehicle.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-[var(--border-primary)]/40 text-xs">
                      <div>
                        <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase">Make / Model</span>
                        <div className="font-medium text-[var(--text-primary)]">{vehicle.make_model || 'Unspecified'}</div>
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase">Color</span>
                        <div className="text-[var(--text-secondary)]">{vehicle.color || 'Unspecified'}</div>
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-[var(--border-primary)]/20 flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                      <span>Source: {vehicle.source_type}</span>
                      <span className="font-mono text-emerald-400 font-medium">Confidence: {Math.round(vehicle.confidence * 100)}%</span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: Locations */}
      {(activeSection === 'all' || activeSection === 'locations') && (
        <div className="space-y-3 pt-4">
          <div className="flex items-center justify-between border-b border-[var(--border-primary)]/60 pb-2">
            <h3 className="text-xs font-mono uppercase font-bold text-[var(--text-primary)] flex items-center gap-2">
              <MapPin className="w-4 h-4 text-cyan-400" />
              Key Incident & Investigation Locations ({locations.length})
            </h3>
            <span className="text-[10px] text-[var(--text-muted)] font-mono">SCENES, JURISDICTIONS & CORRIDORS</span>
          </div>

          {locations.length === 0 ? (
            <div className="p-6 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl">
              No specific location records linked.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {locations.map((loc) => (
                <div key={loc.id} className="p-4 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-[var(--text-primary)]">{loc.name}</h4>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold uppercase mt-1 inline-block">
                        {loc.type}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-[var(--border-primary)]/40 space-y-1 text-xs">
                    {loc.station && (
                      <div className="text-[var(--text-secondary)]">
                        <strong className="text-[var(--text-muted)]">Station:</strong> {loc.station}
                      </div>
                    )}
                    {loc.district && (
                      <div className="text-[var(--text-secondary)]">
                        <strong className="text-[var(--text-muted)]">District:</strong> {loc.district}
                      </div>
                    )}
                    {loc.address && (
                      <div className="text-[var(--text-muted)] text-[11px] mt-1 italic">
                        {loc.address}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECTION 4: Organizations / Syndicates */}
      {(activeSection === 'all' || activeSection === 'organizations') && (
        <div className="space-y-3 pt-4">
          <div className="flex items-center justify-between border-b border-[var(--border-primary)]/60 pb-2">
            <h3 className="text-xs font-mono uppercase font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Building className="w-4 h-4 text-amber-400" />
              Criminal Organizations & Syndicates ({organizations.length})
            </h3>
            <span className="text-[10px] text-[var(--text-muted)] font-mono">ORGANIZED CRIME NETWORKS</span>
          </div>

          {organizations.length === 0 ? (
            <div className="p-6 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl">
              No organized syndicate affiliations identified for this case.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {organizations.map((org) => (
                <div key={org.id} className="p-4 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl shadow-sm">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-[var(--text-primary)]">{org.name}</h4>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold uppercase">
                      {org.risk_level}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-[var(--border-primary)]/40 text-xs">
                    <div>
                      <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase">Syndicate Type</span>
                      <div className="font-medium text-[var(--text-primary)]">{org.type}</div>
                    </div>
                    <div>
                      <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase">Active Members</span>
                      <div className="font-mono text-[var(--text-secondary)]">{org.active_members} identified</div>
                    </div>
                  </div>

                  {org.territory && (
                    <div className="mt-2 text-xs text-[var(--text-muted)]">
                      <strong className="text-[var(--text-secondary)]">Territory:</strong> {org.territory}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECTION 5: Digital Accounts & Telemetry Leads */}
      {(activeSection === 'all' || activeSection === 'digital') && (
        <div className="space-y-3 pt-4">
          <div className="flex items-center justify-between border-b border-[var(--border-primary)]/60 pb-2">
            <h3 className="text-xs font-mono uppercase font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-emerald-400" />
              Digital Accounts & Communication Identifiers ({digitalAccounts.length})
            </h3>
            <span className="text-[10px] text-[var(--text-muted)] font-mono">TELEMETRY, PHONES & DIGITAL LEADS</span>
          </div>

          {digitalAccounts.length === 0 ? (
            <div className="p-6 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl">
              No digital identifiers or phone telemetry records linked.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {digitalAccounts.map((account) => (
                <div key={account.id} className="p-4 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-[var(--accent-teal)]">{account.identifier}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase">
                      {account.account_type}
                    </span>
                  </div>

                  <div className="mt-3 pt-3 border-t border-[var(--border-primary)]/40 text-xs space-y-1">
                    {account.associated_person && (
                      <div className="text-[var(--text-secondary)]">
                        <strong className="text-[var(--text-muted)]">Subject:</strong> {account.associated_person}
                      </div>
                    )}
                    <div className="text-[var(--text-muted)] text-[10px]">
                      Source: {account.source} • Status: {account.verification_status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
