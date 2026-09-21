import React, { useEffect, useState } from "react";
import { useAuditStore } from "../store/auditStore";
import { useAuthStore } from "../store/authStore";
import { ShieldAlert, Terminal, Search, UserMinus } from "lucide-react";
import { downloadSecureDossier } from "../utils/downloader";
import { getOffenderDossiers, type OffenderDossier } from "../services/api";

import { ExportMenu } from "../components/reports";

export const Offenders: React.FC = () => {
  const { logs, addLog, clearLogs } = useAuditStore();
  const { user } = useAuthStore();
  const [offenders, setOffenders] = useState<OffenderDossier[]>([]);
  const [selectedOffenderId, setSelectedOffenderId] = useState("");
  const [selectedWatermark, setSelectedWatermark] = useState(
    "CONFIDENTIAL - SCRB BEATS",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    void getOffenderDossiers()
      .then((response) => {
        if (!isMounted) return;
        setOffenders(response.offenders);
        setSelectedOffenderId(response.offenders[0]?.id ?? "");
        setLoadError(null);
      })
      .catch((error) => {
        if (!isMounted) return;
        setOffenders([]);
        setSelectedOffenderId("");
        setLoadError(
          error instanceof Error
            ? error.message
            : "Failed to load offender dossier records",
        );
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const activeOffender =
    offenders.find((o) => o.id === selectedOffenderId) || offenders[0] || null;

  const filteredOffenders = offenders.filter((item) => {
    const query = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(query) ||
      item.mugshotDesc?.toLowerCase().includes(query) ||
      (item.alias || "").toLowerCase().includes(query)
    );
  });

  const handleExport = (format: "pdf" | "docx" | "txt" | "csv" | "xlsx") => {
    if (!activeOffender || !user) return;
    addLog(
      user.name,
      user.badgeId,
      "EXPORT",
      `Exported dossier for ${activeOffender.name} format: [${format.toUpperCase()}] watermarked: [${selectedWatermark}]`,
    );
    downloadSecureDossier(
      `Offender Dossier - ${activeOffender.name}`,
      activeOffender,
      selectedWatermark,
      format,
    );
  };

  return (
    <div className="min-h-[84vh] flex flex-col gap-5 p-1 md:p-3 select-none">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-[var(--border-muted)] pb-3">
        <div>
          <h2 className="text-md font-mono font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-[#C94A2A] animate-pulse" />
            Registry & System Security Logs
          </h2>
          <p className="text-[9.5px] font-mono text-[var(--text-muted)] mt-0.5">
            LAW ENFORCEMENT BIO-REGISTRY - BACKEND DOSSIERS & CLASSIFIED
            WATERMARK EXPORTS
          </p>
          {loadError && (
            <p className="text-[9px] font-mono text-amber-400 uppercase mt-1">
              {loadError}
            </p>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex-grow w-full grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Panel Skeleton */}
          <div className="lg:col-span-7 bg-[var(--bg-tertiary)]/30 border border-border-color p-5 rounded-card flex flex-col">
            <div className="flex justify-between items-center border-b border-[var(--border-primary)] pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-[#C94A2A]/20 animate-pulse" />
                <div className="h-3.5 bg-white/[0.06] rounded animate-pulse" style={{ width: 180 }} />
              </div>
              <div className="h-8 bg-white/[0.06] rounded animate-pulse" style={{ width: 192 }} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1">
              <div className="md:col-span-4 flex flex-col gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="p-2.5 rounded border border-white/[0.06] bg-white/[0.02]" style={{ animationDelay: `${i * 80}ms` }}>
                    <div className="h-3 bg-white/[0.08] rounded animate-pulse mb-1.5" style={{ width: `${65 + i * 5}%` }} />
                    <div className="h-2.5 bg-white/[0.05] rounded animate-pulse" style={{ width: `${40 + i * 4}%`, animationDelay: `${i * 80 + 100}ms` }} />
                  </div>
                ))}
              </div>
              <div className="md:col-span-8 flex flex-col gap-3">
                <div className="p-3 bg-[var(--bg-secondary)]/50 border border-white/[0.06] rounded flex gap-4">
                  <div className="w-16 h-20 bg-white/[0.05] border border-white/[0.08] rounded shrink-0 animate-pulse" />
                  <div className="flex-1 space-y-2.5 pt-1">
                    <div className="h-3 bg-[#C94A2A]/15 rounded animate-pulse" style={{ width: 60 }} />
                    <div className="h-4 bg-white/[0.08] rounded animate-pulse" style={{ width: '70%', animationDelay: '100ms' }} />
                    <div className="h-3 bg-white/[0.05] rounded animate-pulse" style={{ width: '45%', animationDelay: '200ms' }} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="p-2.5 border border-white/[0.06] rounded bg-white/[0.02]">
                      <div className="h-2 bg-white/[0.05] rounded animate-pulse mb-1.5" style={{ width: '50%' }} />
                      <div className="h-3.5 bg-white/[0.08] rounded animate-pulse" style={{ width: '80%', animationDelay: `${i * 60 + 100}ms` }} />
                    </div>
                  ))}
                </div>
                <div className="h-14 bg-white/[0.03] border border-white/[0.06] rounded animate-pulse" />
              </div>
            </div>
          </div>

          {/* Right Panel Skeleton */}
          <div className="lg:col-span-5 bg-[var(--bg-secondary)] border border-border-color p-4 rounded-card flex flex-col">
            <div className="flex items-center gap-2 border-b border-white/[0.06] pb-3 mb-4">
              <div className="w-4 h-4 rounded-full bg-[#0E9E78]/20 animate-pulse" />
              <div className="h-3.5 bg-white/[0.06] rounded animate-pulse" style={{ width: 200 }} />
            </div>
            <div className="flex-1 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="border-b border-white/[0.04] pb-3" style={{ animationDelay: `${i * 70}ms` }}>
                  <div className="flex justify-between mb-1.5">
                    <div className="h-2 bg-white/[0.06] rounded animate-pulse" style={{ width: '40%' }} />
                    <div className="h-2 bg-white/[0.04] rounded animate-pulse" style={{ width: 55, animationDelay: `${i * 70 + 50}ms` }} />
                  </div>
                  <div className="h-2.5 bg-white/[0.07] rounded animate-pulse" style={{ width: '88%', animationDelay: `${i * 70 + 100}ms` }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (

      <div className="flex-grow w-full grid grid-cols-1 lg:grid-cols-12 gap-5 overflow-hidden">
        <div className="lg:col-span-7 bg-[var(--bg-tertiary)]/30 border border-border-color p-5 rounded-card flex flex-col justify-between overflow-hidden">
          <div className="flex flex-col gap-4 overflow-hidden flex-1">
            <div className="flex justify-between items-center select-none border-b border-[var(--border-primary)] pb-2">
              <span className="text-[10px] font-mono font-bold text-[var(--text-primary)] uppercase tracking-wider">
                Offender Dossier Database
              </span>
              <div className="w-48 flex items-center relative text-xs">
                <input
                  type="text"
                  placeholder="Search alias..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="w-full pl-7 pr-3 py-1 bg-[var(--bg-secondary)]/70 border border-border-color rounded text-[var(--text-primary)] outline-none focus:border-[#C94A2A]"
                />
                <Search className="absolute left-2 w-3.5 h-3.5 text-[var(--text-muted)]" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-grow overflow-hidden">
              <div className="md:col-span-4 overflow-y-auto pr-1 flex flex-col gap-2 custom-scrollbar max-h-[300px]">
                {filteredOffenders.length ? (
                  filteredOffenders.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedOffenderId(item.id)}
                      className={`p-2.5 rounded text-left font-mono text-[10.5px] transition-colors border cursor-pointer ${
                        selectedOffenderId === item.id
                          ? "bg-[#C94A2A]/10 border-[#C94A2A]/40 text-[#C94A2A] font-bold"
                          : "bg-[var(--bg-tertiary)]/50 border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/30"
                      }`}
                    >
                      <span className="block truncate">{item.alias}</span>
                      <span className="text-[8px] text-[var(--text-muted)] block mt-0.5">
                        {item.name}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-center text-[9px] font-mono text-[var(--text-muted)] uppercase border border-dashed border-[var(--border-primary)] rounded">
                    No backend offender dossiers
                  </div>
                )}
              </div>

              <div className="md:col-span-8 overflow-y-auto pr-1 flex flex-col gap-3 custom-scrollbar text-xs font-mono max-h-[300px]">
                {activeOffender ? (
                  <div className="space-y-4">
                    <div className="p-3 bg-[var(--bg-secondary)]/50 border border-[var(--border-primary)] rounded flex gap-4">
                      <div className="w-16 h-20 bg-[var(--bg-tertiary)] border border-[#C94A2A]/30 rounded flex items-center justify-center text-[#C94A2A] relative shrink-0 overflow-hidden select-none">
                        <UserMinus className="w-8 h-8" />
                        <div className="absolute inset-0 border border-dashed border-[#C94A2A]/30 animate-pulse pointer-events-none" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[8.5px] font-bold text-red-500 bg-red-950/20 px-1.5 py-0.5 rounded border border-red-900/30 uppercase">
                          {activeOffender.classification}
                        </span>
                        <h4 className="text-[13px] font-extrabold text-[var(--text-primary)] mt-1.5 truncate">
                          {activeOffender.name}
                        </h4>
                        <span className="text-[9.5px] text-[var(--text-secondary)] block mt-0.5 uppercase tracking-wide">
                          ALIAS: {activeOffender.alias}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="p-2 border border-[var(--border-primary)] rounded">
                        <span className="text-[var(--text-muted)] uppercase text-[8px] block">
                          Threat index
                        </span>
                        <span className="text-[var(--text-primary)] font-bold block mt-0.5">
                          {activeOffender.riskScore}% severity
                        </span>
                      </div>
                      <div className="p-2 border border-[var(--border-primary)] rounded">
                        <span className="text-[var(--text-muted)] uppercase text-[8px] block">
                          Operational state
                        </span>
                        <span className="text-emerald-400 font-bold block mt-0.5 uppercase">
                          {activeOffender.status}
                        </span>
                      </div>
                      <div className="p-2 border border-[var(--border-primary)] rounded">
                        <span className="text-[var(--text-muted)] uppercase text-[8px] block">
                          Primary pattern
                        </span>
                        <span className="text-[var(--text-primary)] font-bold block mt-0.5 truncate">
                          {activeOffender.gangAffiliation}
                        </span>
                      </div>
                      <div className="p-2 border border-[var(--border-primary)] rounded">
                        <span className="text-[var(--text-muted)] uppercase text-[8px] block">
                          Key sectors
                        </span>
                        <span className="text-[var(--text-primary)] font-bold block mt-0.5 truncate">
                          {activeOffender.activeDistricts.join(", ") ||
                            "No linked districts"}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 border border-[var(--border-primary)] rounded text-[var(--text-secondary)] leading-relaxed">
                      {activeOffender.mugshotDesc}
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-center text-[var(--text-muted)] uppercase">
                    No backend profile highlighted
                  </div>
                )}
              </div>
            </div>
          </div>

          {activeOffender && (
            <div className="pt-4 border-t border-border-color mt-4 flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 w-full flex flex-col gap-1 text-[10px] font-mono text-left">
                <span className="text-[var(--text-muted)] uppercase font-bold">
                  Select Security Watermark String
                </span>
                <select
                  value={selectedWatermark}
                  onChange={(event) => setSelectedWatermark(event.target.value)}
                  className="w-full p-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded outline-none text-xs focus:border-[#C94A2A]"
                >
                  <option
                    value={`CONFIDENTIAL - BADGE: ${user?.badgeId || "SYSTEM"}`}
                  >
                    CONFIDENTIAL - Officer Badge ID
                  </option>
                  <option value="STRICT LAW ENFORCEMENT ONLY">
                    RESTRICTED - Law Enforcement Only
                  </option>
                  <option value="CLASSIFIED INTERNAL SCRB INTELLIGENCE">
                    CLASSIFIED - SCRB Internal Intel
                  </option>
                </select>
              </div>

              <ExportMenu onExport={(format) => handleExport(format)} />
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-[var(--bg-secondary)] border border-border-color p-4 rounded-card flex flex-col justify-between overflow-hidden">
          <div className="flex flex-col gap-3 overflow-hidden flex-1 select-none">
            <div className="flex justify-between items-center border-b border-[var(--border-primary)] pb-2">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#0E9E78] animate-pulse" />
                <span className="text-[10px] font-mono font-bold text-[var(--text-primary)] uppercase tracking-wider">
                  Session Activity Log
                </span>
              </div>
              <button
                onClick={clearLogs}
                className="text-[8px] font-mono bg-[var(--bg-tertiary)] hover:bg-[var(--bg-elevated)] border border-[var(--border-primary)] px-2 py-0.5 rounded text-amber-500 cursor-pointer"
              >
                Clear Screen
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 custom-scrollbar max-h-[360px]">
              {logs.map((log) => {
                const color =
                  log.actionType === "EXPORT"
                    ? "text-red-400"
                    : log.actionType === "AUTH"
                      ? "text-emerald-400"
                      : log.actionType === "REVIEW"
                        ? "text-sky-400"
                        : log.actionType === "ESCALATION"
                          ? "text-purple-400"
                          : "text-[var(--text-secondary)]";
                return (
                  <div
                    key={log.id}
                    className="text-[8.5px] font-mono leading-relaxed border-b border-[var(--border-muted)] pb-1 flex flex-col gap-0.5 text-left"
                  >
                    <div className="flex justify-between text-[var(--text-muted)] select-none">
                      <span>
                        {new Date(log.timestamp).toLocaleTimeString()}
                        {log.ipAddress ? ` - IP: ${log.ipAddress}` : ""}
                      </span>
                      <span className="font-bold uppercase tracking-wider">
                        {log.actionType}
                      </span>
                    </div>
                    <div className={color}>
                      <span className="text-[var(--text-primary)] font-semibold">
                        [{log.badgeId}]
                      </span>{" "}
                      {log.details}
                    </div>
                  </div>
                );
              })}

              {logs.length === 0 && (
                <div className="h-full flex items-center justify-center p-6 text-center text-[8.5px] font-mono text-[var(--text-secondary)] uppercase">
                  Audits queue empty - awaiting security triggers
                </div>
              )}
            </div>
          </div>

          <div className="pt-2 text-[8px] font-mono text-[var(--text-secondary)] text-left border-t border-[var(--border-primary)]/60 mt-3 select-none">
            TELEMETRY SECURITY KEY OVERLAY ON EXPORTED PDF DOCUMENT MATCHES
            LEGAL STAMP COMPLIANCE 2026.
          </div>
        </div>
      </div>
      )}
    </div>
  );
};

export default Offenders;
