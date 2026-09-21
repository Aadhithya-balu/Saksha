import React, { useState, useEffect } from "react";
import { useTranslation } from '../../i18n';
import { useAuthStore } from "../../store/authStore";
import { useAuditStore } from "../../store/auditStore";
import { downloadSecureDossier } from "../../utils/downloader";
import { usePolling } from "../../hooks/usePolling";
import {
  listFIRs,
  getFIR,
  createFIR,
  updateFIR,
  deleteFIR,
  type FIRRecord,
  type FIRDetailRecord,
} from "../../services/api";
import { FIRForm } from "../../components/fir/FIRForm";
import { FIRTimeline } from "../../components/fir/FIRTimeline";
import { FIRAttachments } from "../../components/fir/FIRAttachments";
import { FIRRiskScore } from "../../components/fir/FIRRiskScore";
import { IntelligenceWorkspace } from "../../components/intelligence/IntelligenceWorkspace";
import {
  Search,
  Plus,
  AlertTriangle,
  MapPin,
  FileText,
  Trash2,
  Edit3,
  ShieldCheck,
  Activity,
  FolderOpen,
  UserCheck,
  ArrowRight,
  Brain,
} from "lucide-react";
import { ExportMenu } from "../../components/reports";
import { CardSkeleton } from "../../components/ui/Skeleton";
import PageHeader from "../../components/ui/PageHeader";
import { useUserScope } from "../../hooks/useUserScope";

const DISTRICTS = [
  "Bengaluru Urban",
  "Bengaluru Rural",
  "Mysuru",
  "Belagavi",
  "Dharwad",
  "Kalaburagi",
  "Vijayapura",
  "Ballari",
  "Bidar",
  "Hassan",
  "Tumkuru",
  "Mandya",
  "Shimoga",
  "Davanagere",
  "Chitradurga",
  "Kodagu",
  "Chikkamagaluru",
  "Haveri",
  "Gadag",
  "Bagalkote",
  "Koppal",
  "Yadagir",
  "Raichur",
  "Kolar",
  "Chikkaballapura",
  "Ramanagara",
  "Chamarajanagar",
  "Vijayanagara",
  "Dakshina Kannada",
  "Udupi",
  "Uttara Kannada",
];

export const FIRPage: React.FC = () => {
  const t = useTranslation();
  const { user } = useAuthStore();
  const { district: scopeDistrict, canSelectDistrict } = useUserScope();
  const { addLog } = useAuditStore();

  // Page States
  const [firs, setFirs] = useState<FIRRecord[]>([]);
  const [selectedFirId, setSelectedFirId] = useState<string | null>(null);
  const [selectedFir, setSelectedFir] = useState<FIRDetailRecord | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showIntelligence, setShowIntelligence] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters State — district defaults to the operator's own district
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState<string>(() => scopeDistrict || "");

  // Fetch FIR List
  const loadFIRList = async () => {
    setIsLoadingList(true);
    setError(null);
    try {
      const response = await listFIRs({
        search: searchQuery || undefined,
        status: statusFilter || undefined,
        district: districtFilter || undefined,
        page_size: 100,
      });
      setFirs(response.results || []);

      // Auto-select first item if none selected and lists exist
      if (response.results?.length > 0 && !selectedFirId && !showForm) {
        setSelectedFirId(response.results[0].id);
      }
    } catch (err) {
      setError("Failed to query the FIR database. Check server state.");
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    void loadFIRList();
  }, [searchQuery, statusFilter, districtFilter, scopeDistrict, canSelectDistrict]);

  // Auto-open the enrolment form when reached from a dashboard Quick Action
  useEffect(() => {
    const quickIntent = sessionStorage.getItem('quick_action_intent');
    if (quickIntent === 'Register FIR') {
      sessionStorage.removeItem('quick_action_intent');
      setIsEditing(false);
      setShowForm(true);
    }
  }, []);

  // Background polling: silently refresh FIR list every 30s
  usePolling(async () => {
    try {
      const response = await listFIRs({
        search: searchQuery || undefined,
        status: statusFilter || undefined,
        district: canSelectDistrict ? districtFilter || undefined : scopeDistrict || undefined,
        page_size: 100,
      });
      setFirs(response.results || []);
    } catch { /* silent */ }
  }, 30000);

  // Fetch Single FIR Detail
  useEffect(() => {
    if (!selectedFirId) {
      setSelectedFir(null);
      return;
    }

    let isMounted = true;
    const fetchDetail = async () => {
      setIsLoadingDetail(true);
      setError(null);
      try {
        const detail = await getFIR(selectedFirId);
        if (isMounted) {
          setSelectedFir(detail);
        }
      } catch (err) {
        if (isMounted) {
          setError("Failed to fetch detailed case summary.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingDetail(false);
        }
      }
    };

    void fetchDetail();
    return () => {
      isMounted = false;
    };
  }, [selectedFirId]);

  // Form Handlers
  const handleCreateNewClick = () => {
    setIsEditing(false);
    setShowForm(true);
  };

  const handleFormSubmit = async (payload: any) => {
    try {
      if (isEditing && selectedFirId) {
        // Update FIR
        await updateFIR(selectedFirId, payload);
        setShowForm(false);
        await loadFIRList();
        // Force refresh details
        const refreshed = await getFIR(selectedFirId);
        setSelectedFir(refreshed);

        if (user) {
          addLog(
            user.name,
            user.badgeId,
            "UPDATE",
            `Updated FIR record details for case [${refreshed.fir_number}]`,
          );
        }
      } else {
        // Create FIR
        const created = await createFIR(payload);
        setShowForm(false);
        setSelectedFirId(created.id);
        await loadFIRList();

        if (user) {
          addLog(
            user.name,
            user.badgeId,
            "CREATE",
            `Registered new FIR record in catalog [${created.fir_number}]`,
          );
        }
      }
    } catch (err: any) {
      throw new Error(err.message || "Failed to persist FIR record.");
    }
  };

  const handleDeleteClick = async () => {
    if (!selectedFir || !user) return;

    const confirmText = `Are you sure you want to delete classified FIR: ${selectedFir.fir_number}?\nThis action will log system audit alerts.`;
    if (!window.confirm(confirmText)) {
      return;
    }

    try {
      await deleteFIR(selectedFir.id);
      addLog(
        user.name,
        user.badgeId,
        "DELETE",
        `Permanently purged FIR registry record: [${selectedFir.fir_number}]`,
      );
      setSelectedFirId(null);
      setSelectedFir(null);
      await loadFIRList();
    } catch (err) {
      alert("Delete forbidden. Check credentials and role privileges.");
    }
  };

  const handleExportPDF = (format: "pdf" | "docx" | "txt" | "csv" | "xlsx" = "pdf") => {
    if (!selectedFir || !user) return;

    addLog(
      user.name,
      user.badgeId,
      "EXPORT",
      `Exported secure dossier printout for FIR case [${selectedFir.fir_number}]`,
    );

    const exportData = {
      DOCUMENT_TYPE: "CLASSIFIED FIRST INFORMATION REPORT (FIR)",
      EXPORTED_BY: `${user.name} (Badge: ${user.badgeId})`,
      SECURITY_CLEARANCE: "LEVEL-3 CLASSIFIED",
      TIMESTAMP: new Date().toISOString(),
      FIR_DETAILS: {
        fir_number: selectedFir.fir_number,
        filed_at: selectedFir.filed_at,
        complainant_name: selectedFir.complainant_name,
        complainant_contact: selectedFir.complainant_contact || "None",
        sections: selectedFir.sections || "Unspecified",
        narrative: selectedFir.narrative || "No statement details",
        status: selectedFir.status.toUpperCase(),
      },
      LINKED_CRIME_CASE: selectedFir.crime_case
        ? {
            case_number: selectedFir.crime_case.case_number,
            occurred_at:
              selectedFir.crime_case.occurred_at ||
              selectedFir.crime_case.reported_at,
            status: selectedFir.crime_case.status.toUpperCase(),
            description: selectedFir.crime_case.description,
          }
        : "No Linked Case",
      INVESTIGATING_OFFICER: selectedFir.investigating_officer
        ? {
            badge_number: selectedFir.investigating_officer.badge_number,
            rank: selectedFir.investigating_officer.rank || "Officer",
            district: selectedFir.investigating_officer.district,
            station: selectedFir.investigating_officer.station,
          }
        : "Unassigned",
      ACCUSED_ACCUSED: selectedFir.criminals.map((c) => ({
        name: c.full_name,
        alias: c.aliases || "None",
      })),
      VICTIMS_NAMED: selectedFir.victims.map((v) => v.full_name),
    };

    downloadSecureDossier(
      `FIR_DOSSIER_${selectedFir.fir_number.replace(/\//g, "_")}`,
      exportData,
      `CONFIDENTIAL - ${user.badgeId} - ${user.role}`,
      format,
    );
  };

  const handleAttachmentAdded = (updatedAttachments: any[]) => {
    if (selectedFir) {
      setSelectedFir({
        ...selectedFir,
        attachments: updatedAttachments,
      });
    }
  };

  // UI Helpers
  const getStatusBadge = (statusStr: string) => {
    switch (statusStr) {
      case "closed":
        return (
          <span className="px-2.5 py-0.5 bg-emerald-950/40 text-emerald-400 border border-emerald-900/40 text-[9px] rounded font-bold uppercase select-none flex items-center gap-1 shrink-0">
            <ShieldCheck className="w-3 h-3" />
            RESOLVED
          </span>
        );
      case "in_progress":
        return (
          <span className="px-2.5 py-0.5 bg-amber-950/40 text-amber-400 border border-amber-900/40 text-[9px] rounded font-bold uppercase select-none flex items-center gap-1 shrink-0">
            <Activity className="w-3 h-3 animate-pulse" />
            UNDER INQUIRY
          </span>
        );
      case "registered":
      default:
        return (
          <span className="px-2.5 py-0.5 bg-blue-950/40 text-blue-400 border border-blue-900/40 text-[9px] rounded font-bold uppercase select-none flex items-center gap-1 shrink-0">
            <FolderOpen className="w-3 h-3" />
            REGISTERED
          </span>
        );
    }
  };

  return (
    <div className="min-h-[84vh] flex flex-col gap-4 p-1 md:p-3 select-none">
      {/* Top Header */}
      <div className="pb-3 shrink-0 flex flex-col gap-2">
        <PageHeader
          title={t.fir_title}
          subtitle={t.fir_subtitle}
          icon={<FileText className="w-5 h-5" />}
          actions={
            <>
              {scopeDistrict && (
                <span
                  className="sk-header-chip hidden sm:inline-flex"
                  data-accent="cyan"
                  title="Your operating area — set from your profile"
                >
                  <MapPin className="w-3 h-3" />
                  {scopeDistrict}
                </span>
              )}
              {(user?.role === "ADMIN" || user?.role === "IO") && !showForm && (
                <button
                  onClick={handleCreateNewClick}
                  className="sk-btn cursor-pointer"
                  style={{ background: 'var(--accent-blue)', borderColor: 'var(--accent-blue)', color: '#fff' }}
                >
                  <Plus className="w-4 h-4" /> {t.fir_create_new}
                </button>
              )}
            </>
          }
        />
        {error && (
          <p className="text-xs font-medium text-[var(--accent-coral-light)]">{error}</p>
        )}
      </div>

      {/* Main split viewport layout */}
      <div className="flex-grow w-full grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden min-h-0">
        {/* Left Side: Filter search list panel */}
        <div className="lg:col-span-4 bg-[var(--bg-tertiary)]/20 border border-border-color p-4 rounded-card flex flex-col justify-between overflow-hidden">
          <div className="flex flex-col gap-3 overflow-hidden flex-1">
            <span className="text-[10px] font-mono font-bold text-[var(--text-primary)] uppercase tracking-wider border-b border-[var(--border-primary)] pb-2 shrink-0">
              {t.fir_directory}
            </span>

            {/* Filters panel */}
            <div className="space-y-2 shrink-0 text-[10px] font-mono">
              {/* Search text input */}
              <div className="flex items-center relative">
                <input
                  type="text"
                  placeholder={t.fir_search_hint}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-[var(--bg-secondary)]/70 border border-[var(--border-primary)] rounded text-[var(--text-primary)] outline-none focus:border-[#1E6FD9] text-[10.5px]"
                />
                <Search className="absolute left-2.5 w-3.5 h-3.5 text-[var(--text-muted)]" />
              </div>

              {/* Filtering selects */}
              <div className="grid grid-cols-2 gap-2 text-[9px]">
                {/* Status selector */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-2 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded text-[var(--text-secondary)] outline-none focus:border-[#1E6FD9] cursor-pointer"
                >
                  <option value="">{t.ui_filter_all}</option>
                  <option value="registered">Registered</option>
                  <option value="in_progress">In Inquiry</option>
                  <option value="closed">Resolved</option>
                </select>

                {/* District selector — locked for district-scoped operators */}
                {canSelectDistrict ? (
                  <select
                    value={districtFilter}
                    onChange={(e) => setDistrictFilter(e.target.value)}
                    className="w-full px-2 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded text-[var(--text-secondary)] outline-none focus:border-[#1E6FD9] cursor-pointer"
                  >
                    <option value="">All Districts</option>
                    {DISTRICTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                ) : scopeDistrict ? (
                  <div
                    className="w-full px-2 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded text-[var(--text-secondary)] !cursor-not-allowed opacity-90 select-none"
                    title="Your data scope is fixed to your operating area"
                  >
                    {scopeDistrict}
                  </div>
                ) : (
                  <select
                    value={districtFilter}
                    onChange={(e) => setDistrictFilter(e.target.value)}
                    className="w-full px-2 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded text-[var(--text-secondary)] outline-none focus:border-[#1E6FD9] cursor-pointer"
                  >
                    <option value="">All Districts</option>
                    {DISTRICTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* List scroll view */}
            <div className="flex-grow overflow-y-auto pr-1 flex flex-col gap-2 custom-scrollbar">
              {isLoadingList ? (
                <div className="flex flex-col gap-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="p-3 rounded-md border border-[var(--border-primary)] bg-[var(--bg-tertiary)]/40 space-y-2">
                      <div className="sk-skeleton rounded-sm h-3.5 w-2/3" />
                      <div className="sk-skeleton rounded-sm h-2.5 w-1/2" />
                      <div className="sk-skeleton rounded-sm h-2 w-1/3" />
                    </div>
                  ))}
                </div>
              ) : firs.length > 0 ? (
                firs.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSelectedFirId(item.id);
                      setShowForm(false);
                    }}
                    className={`p-3 rounded-md text-left font-mono transition-all border cursor-pointer flex justify-between gap-3 ${
                      selectedFirId === item.id && !showForm
                        ? "bg-[#1E6FD9]/10 border-[#1E6FD9]/30 text-[var(--text-primary)] shadow-glow-blue"
                        : "bg-[var(--bg-tertiary)]/40 border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]/20 hover:border-[var(--border-primary)]"
                    }`}
                  >
                    <div className="min-w-0 space-y-1">
                      <span className="text-[11.5px] font-bold block truncate text-[var(--text-primary)]">
                        {item.fir_number}
                      </span>
                      <span className="text-[9.5px] text-[var(--text-muted)] block truncate">
                        Complainant: {item.complainant_name}
                      </span>
                      <span className="text-[8px] text-[var(--text-muted)] block">
                        FILED:{" "}
                        {new Date(item.filed_at).toLocaleDateString("en-IN")}
                      </span>
                    </div>
                    <div className="flex items-start shrink-0">
                      {item.status === "closed" ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1" />
                      ) : item.status === "in_progress" ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1 animate-pulse" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1" />
                      )}
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-8 text-center text-[10px] text-[var(--text-muted)] uppercase border border-dashed border-[var(--border-primary)] rounded-lg">
                  No records matching filters
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: detail view / form panels */}
        <div className="lg:col-span-8 flex flex-col overflow-hidden relative">
          {showIntelligence && selectedFir ? (
            <div className="flex-grow overflow-y-auto custom-scrollbar">
              <IntelligenceWorkspace
                entityType="fir"
                entityId={selectedFir.id}
                entityLabel={selectedFir.fir_number}
                onClose={() => setShowIntelligence(false)}
              />
            </div>
          ) : showForm ? (
            /* Create / Edit Form */
            <div className="flex-grow overflow-y-auto custom-scrollbar">
              <FIRForm
                fir={isEditing ? selectedFir : null}
                onSubmit={handleFormSubmit}
                onCancel={() => setShowForm(false)}
              />
            </div>
          ) : isLoadingDetail ? (
            /* Loading Detail */
            <div className="flex-grow p-4">
              <CardSkeleton />
            </div>
          ) : selectedFir ? (
            /* Detailed View */
            <div className="flex-grow flex flex-col justify-between overflow-y-auto custom-scrollbar pr-1 gap-4">
              {/* Detail Header HUD */}
              <div className="p-4 bg-[var(--bg-tertiary)]/35 border border-border-color rounded-card shrink-0 flex flex-col gap-3 w-full">
                <div className="min-w-0 w-full">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-extrabold text-[var(--text-primary)] font-mono select-all tracking-wide break-words">
                      {selectedFir.fir_number}
                    </h3>
                    {getStatusBadge(selectedFir.status)}
                  </div>
                  <p className="text-[8.5px] font-mono text-[var(--text-muted)] mt-1 uppercase break-words">
                    SAKSHA CASE COMMAND DOSSIER INDEXID:{" "}
                    {selectedFir.id.slice(0, 8)}...
                  </p>
                </div>

                {/* Actions Toolbar */}
                <div className="flex flex-wrap items-center gap-1.5 font-mono text-[9px] uppercase shrink-0 justify-start">
                  <button
                    onClick={() => setShowIntelligence(true)}
                    className="px-2.5 py-1.5 bg-[#a855f7]/10 hover:bg-[#a855f7]/20 border border-[#a855f7]/20 hover:border-[#a855f7]/40 text-[#a855f7] rounded-btn transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Brain className="w-3.5 h-3.5" />
                    {t.fir_build_intelligence}
                  </button>
                  {(user?.role === "ADMIN" || user?.role === "IO") && (
                    <>
                      <button
                        onClick={() => {
                          setIsEditing(true);
                          setShowForm(true);
                        }}
                        className="px-2.5 py-1.5 bg-[var(--bg-tertiary)] hover:bg-[#1E6FD9]/15 border border-[var(--border-primary)] hover:border-[#1E6FD9]/30 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-btn transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        {t.fir_edit}
                      </button>
                      <button
                        onClick={handleDeleteClick}
                        className="px-2.5 py-1.5 bg-[#C94A2A]/10 hover:bg-[#C94A2A]/20 border border-[#C94A2A]/20 hover:border-[#C94A2A]/40 text-[#C94A2A] rounded-btn transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {t.fir_purge}
                      </button>
                    </>
                  )}
                  <ExportMenu onExport={(format) => handleExportPDF(format)} />
                </div>
              </div>

              {/* Main Metadata Grid */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 shrink-0 font-mono text-xs text-[var(--text-secondary)]">
                {/* Complainant & Narrative panel */}
                <div className="md:col-span-8 bg-[var(--bg-tertiary)]/15 border border-[var(--border-primary)] rounded-lg p-4 space-y-4">
                  <span className="block text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-wider">
                    Statement Information
                  </span>

                  <div className="grid grid-cols-2 gap-3 text-[10.5px]">
                    <div>
                      <span className="text-[8px] text-[var(--text-muted)] uppercase block">
                        {t.fir_complainant}
                      </span>
                      <span className="text-[var(--text-primary)] font-bold block mt-0.5">
                        {selectedFir.complainant_name}
                      </span>
                    </div>
                    <div>
                      <span className="text-[8px] text-[var(--text-muted)] uppercase block">
                        {t.fir_contact}
                      </span>
                      <span className="text-[var(--text-primary)] font-semibold block mt-0.5">
                        {selectedFir.complainant_contact || "NOT LOGGED"}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[8px] text-[var(--text-muted)] uppercase block mb-1">
                      Penal Sections Charged
                    </span>
                    <span className="px-2 py-1 bg-[var(--bg-secondary)]/70 border border-[var(--border-primary)] text-amber-400 font-bold rounded block text-[10px] w-fit">
                      {selectedFir.sections || "IPC GENERAL QUERY INQUIRY"}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[8px] text-[var(--text-muted)] uppercase block">
                      {t.fir_narrative}
                    </span>
                    <div className="p-3 bg-[var(--bg-secondary)]/70 border border-[var(--border-primary)] text-[var(--text-primary)] rounded text-[10px] leading-relaxed max-h-[120px] overflow-y-auto custom-scrollbar">
                      {selectedFir.narrative ||
                        "No statement summary logged in database."}
                    </div>
                  </div>
                </div>

                {/* Investigating Team & Case Card */}
                <div className="md:col-span-4 space-y-4 flex flex-col">
                  {/* Case link card */}
                  {selectedFir.crime_case ? (
                    <div className="bg-[var(--bg-tertiary)]/15 border border-[var(--border-primary)] rounded-lg p-4 flex-1">
                      <span className="block text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-wider mb-2.5 flex items-center justify-between">
                        Incident Link
                        <span className="px-1.5 py-0.5 bg-[#1E6FD9]/15 text-[#1E6FD9] border border-[#1E6FD9]/30 rounded text-[7.5px] font-bold">
                          LINKED
                        </span>
                      </span>
                      <p className="text-[11px] font-bold text-[var(--text-primary)] uppercase truncate">
                        {selectedFir.crime_case.case_number}
                      </p>
                      <p className="text-[9px] text-[var(--text-muted)] mt-1">
                        Reported:{" "}
                        {new Date(
                          selectedFir.crime_case.reported_at,
                        ).toLocaleDateString("en-IN")}
                      </p>
                      <p className="text-[9.5px] text-[var(--text-secondary)] mt-2 line-clamp-3 leading-relaxed">
                        {selectedFir.crime_case.description}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-[var(--bg-secondary)]/40 border border-dashed border-[var(--border-primary)] rounded-lg p-4 flex-1 flex flex-col items-center justify-center text-center">
                      <AlertTriangle className="w-5 h-5 text-amber-500/60 mb-2" />
                      <span className="text-[9px] uppercase text-[var(--text-muted)]">
                        No case file linkage
                      </span>
                    </div>
                  )}

                  {/* Officer assigned card */}
                  <div className="bg-[var(--bg-tertiary)]/15 border border-[var(--border-primary)] rounded-lg p-4">
                    <span className="block text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-wider mb-2.5">
                      Command Officer
                    </span>
                    {selectedFir.investigating_officer ? (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#1E6FD9]/15 border border-[#1E6FD9]/30 flex items-center justify-center text-[#1E6FD9]">
                          <UserCheck className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-[var(--text-primary)] truncate">
                            Inspector{" "}
                            {selectedFir.investigating_officer.badge_number}
                          </p>
                          <p className="text-[8px] text-[var(--text-muted)] truncate">
                            {selectedFir.investigating_officer.rank ||
                              "Officer"}{" "}
                            â€¢ {selectedFir.investigating_officer.station}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[9px] text-amber-500 uppercase font-bold">
                        Unassigned (Action Required)
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Linked Persons Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0 font-mono text-[10px]">
                {/* Linked Suspects */}
                <div className="bg-[var(--bg-tertiary)]/10 border border-[var(--border-primary)] rounded-lg p-4">
                  <span className="block text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-wider mb-2.5">
                    {t.fir_accused} ({selectedFir.criminals.length})
                  </span>
                  <div className="space-y-2 max-h-[140px] overflow-y-auto custom-scrollbar">
                    {selectedFir.criminals.map((c) => (
                      <div
                        key={c.id}
                        className="p-2 bg-[var(--bg-secondary)]/40 border border-[var(--border-primary)] rounded flex justify-between gap-3"
                      >
                        <div>
                          <p className="font-bold text-[var(--text-primary)]">
                            {c.full_name}
                          </p>
                          <p className="text-[var(--text-muted)] text-[8px] mt-0.5">
                            ALIAS: {c.aliases || "None"}
                          </p>
                        </div>
                        <span className="text-[7.5px] uppercase font-bold text-red-400 bg-red-950/20 border border-red-900/30 px-1 py-0.5 rounded select-none h-fit">
                          {c.status.replace("_", " ")}
                        </span>
                      </div>
                    ))}
                    {selectedFir.criminals.length === 0 && (
                      <p className="text-[var(--text-muted)] text-center uppercase py-3">
                        No suspects linked to FIR
                      </p>
                    )}
                  </div>
                </div>

                {/* Linked Victims */}
                <div className="bg-[var(--bg-tertiary)]/10 border border-[var(--border-primary)] rounded-lg p-4">
                  <span className="block text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-wider mb-2.5">
                    {t.fir_victims} ({selectedFir.victims.length})
                  </span>
                  <div className="space-y-2 max-h-[140px] overflow-y-auto custom-scrollbar">
                    {selectedFir.victims.map((v) => (
                      <div
                        key={v.id}
                        className="p-2 bg-[var(--bg-secondary)]/40 border border-[var(--border-primary)] rounded space-y-1"
                      >
                        <div className="flex justify-between items-center">
                          <p className="font-bold text-[var(--text-primary)]">
                            {v.full_name}
                          </p>
                          {v.gender && v.age && (
                            <span className="text-[var(--text-muted)] text-[8px] uppercase">
                              {v.gender} â€¢ AGE: {v.age}
                            </span>
                          )}
                        </div>
                        <p className="text-[var(--text-secondary)] text-[8.5px] line-clamp-2 italic leading-relaxed">
                          "{v.statement || "No victim statement logged."}"
                        </p>
                      </div>
                    ))}
                    {selectedFir.victims.length === 0 && (
                      <p className="text-[var(--text-muted)] text-center uppercase py-3">
                        No victims linked to FIR
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Dynamic widgets grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
                {/* AI Risk Meter */}
                <FIRRiskScore
                  score={selectedFir.ai_risk_score}
                  reasons={selectedFir.ai_analysis_reasons}
                />

                {/* Hotspot prediction mini panel */}
                <div className="bg-[var(--bg-tertiary)]/30 border border-border-color p-5 rounded-card flex flex-col justify-between overflow-hidden relative">
                  <div className="flex items-center justify-between border-b border-[var(--border-primary)] pb-3 mb-4 font-mono">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-rose-500" />
                      <span className="text-[10px] font-bold text-[var(--text-primary)] uppercase tracking-wider">
                        Linked Hotspot Metrics
                      </span>
                    </div>
                    <span className="text-[8px] text-[var(--text-muted)] uppercase">
                      GRID DECK.GL COORDS
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 font-mono text-xs items-center">
                    {/* Location specs */}
                    <div className="space-y-3">
                      <div>
                        <span className="text-[8px] text-[var(--text-muted)] uppercase block">
                          District Precinct
                        </span>
                        <span className="text-[var(--text-primary)] font-bold block mt-0.5 uppercase tracking-wide">
                          {selectedFir.investigating_officer?.district ||
                            (selectedFir.crime_case ? `Location ID: ${selectedFir.crime_case.location_id.slice(0, 8)}` : "State HQ")}
                        </span>
                      </div>
                      <div>
                        <span className="text-[8px] text-[var(--text-muted)] uppercase block">
                          Coordinates
                        </span>
                        <span className="text-[var(--text-primary)] block mt-0.5 text-[10px] select-all">
                          {"12.9716"}
                          ,{" "}
                          {"77.5946"}
                        </span>
                      </div>
                    </div>

                    {/* Stats metrics */}
                    <div className="p-3 bg-[var(--bg-secondary)]/50 border border-[var(--border-primary)] rounded space-y-2 text-center">
                      <span className="text-[7.5px] text-[var(--text-muted)] uppercase tracking-widest block font-bold">
                        {t.fir_risk_index}
                      </span>
                      <span className="text-xl font-extrabold text-red-400 block leading-none">
                        82%
                      </span>
                      <span className="text-[8px] text-emerald-400 font-semibold block uppercase">
                        TRENDING UPWARD
                      </span>
                    </div>
                  </div>

                  <div className="border border-[var(--border-primary)] p-2.5 rounded bg-[var(--bg-secondary)]/20 text-[9.5px] font-mono leading-relaxed text-[var(--text-secondary)] flex items-center justify-between gap-3 mt-3">
                    <span>
                      Target beat patrol recommendation generated. Dispatching
                      auto-telemetry alerts.
                    </span>
                    <ArrowRight className="w-4 h-4 text-[#1E6FD9] shrink-0" />
                  </div>
                </div>
              </div>

              {/* Uploads and timeline grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
                {/* Visual Event Timeline */}
                <FIRTimeline fir={selectedFir} />

                {/* Attachments Section */}
                <FIRAttachments
                  fir={selectedFir}
                  onAttachmentAdded={handleAttachmentAdded}
                />
              </div>
            </div>
          ) : (
            /* Selected Placeholder */
            <div className="flex-grow flex flex-col items-center justify-center p-12 border border-dashed border-[var(--border-primary)] rounded-lg text-center space-y-4">
              <FolderOpen className="w-10 h-10 text-[var(--text-muted)] animate-bounce" />
              <div className="space-y-1 select-none">
                <span className="text-xs uppercase tracking-wider text-[var(--text-primary)] font-bold font-mono">
                  {t.fir_no_fir_selected}
                </span>
                <p className="text-[9.5px] text-[var(--text-muted)] font-mono uppercase">
                  {t.fir_select_hint}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default FIRPage;
