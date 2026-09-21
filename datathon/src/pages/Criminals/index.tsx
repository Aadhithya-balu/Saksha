import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n';
import { useAuthStore } from '../../store/authStore';
import { useAuditStore } from '../../store/auditStore';
import { useRBAC } from '../../hooks/useRBAC';
import { usePolling } from '../../hooks/usePolling';
import { 
  listCriminals, 
  getCriminal,
  updateCriminal,
  uploadCriminalImage,
} from '../../services/api';
import { 
  Search, 
  ShieldAlert, 
  Activity, 
  MapPin, 
  AlertTriangle, 
  Users, 
  FileText, 
  TrendingUp, 
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  Sparkles,
  Camera,
  Brain,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { PersonAvatar } from '../../components/ui/PersonAvatar';
import { IntelligenceWorkspace } from '../../components/intelligence/IntelligenceWorkspace';

interface CriminalSummary {
  id: string;
  full_name: string;
  aliases: string | null;
  date_of_birth: string | null;
  gender: string | null;
  status: string;
}

export const Criminals: React.FC = () => {
  const t = useTranslation();
  const { user } = useAuthStore();
  const { addLog } = useAuditStore();
  const { isAdmin, isIO } = useRBAC();
  const canWrite = isAdmin || isIO;

  const [criminals, setCriminals] = useState<CriminalSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loadingList, setLoadingList] = useState<boolean>(true);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false);
  const [criminalDetails, setCriminalDetails] = useState<any>(null);
  const [hoveredNode, setHoveredNode] = useState<any>(null);
  const [showIntelligence, setShowIntelligence] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState<Record<string, any>>({});
  const imageInputRef = React.useRef<HTMLInputElement>(null);

  // Load criminals on mount or search
  useEffect(() => {
    let isMounted = true;
    setLoadingList(true);
    
    // Check if there is a target ID from redirect session
    const redirectId = sessionStorage.getItem('selected_entity_id');
    
    listCriminals(searchQuery)
      .then((res) => {
        if (!isMounted) return;
        setCriminals(res.results || []);
        
        // Determine initial selected ID
        if (redirectId) {
          setSelectedId(redirectId);
          sessionStorage.removeItem('selected_entity_id');
        } else if (res.results && res.results.length > 0 && !selectedId) {
          setSelectedId(res.results[0].id);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Failed to load criminal records:', err.message);
      })
      .finally(() => {
        if (isMounted) setLoadingList(false);
      });

    return () => {
      isMounted = false;
    };
  }, [searchQuery]);

  // Background polling: silently refresh criminal list every 30s
  usePolling(async () => {
    try {
      const res = await listCriminals(searchQuery);
      setCriminals(res.results || []);
    } catch { /* silent */ }
  }, 30000);

  // Load criminal details when selectedId changes
  useEffect(() => {
    if (!selectedId) return;
    let isMounted = true;
    setLoadingDetails(true);

    getCriminal(selectedId)
      .then((res) => {
        if (!isMounted) return;
        setCriminalDetails(res);
        
        // Log access audit
        if (user) {
          addLog(
            user.name,
            user.badgeId,
            'REVIEW',
            `Accessed criminal intelligence file for: ${res.full_name} (${res.id})`
          );
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Failed to load criminal details:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingDetails(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedId, user]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedId) return;
    setUploadingImage(true);
    setImageUploadError(null);
    try {
      const res = await uploadCriminalImage(selectedId, file);
      setCriminalDetails((prev: any) => ({ ...prev, image_url: res.image_url }));
    } catch (err: any) {
      console.error('Image upload failed:', err.message);
      setImageUploadError(err.message || 'Unable to upload the image.');
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const handleSelectCriminal = (id: string) => {
    setSelectedId(id);
  };

  const navigateToVictim = (victimId: string) => {
    window.dispatchEvent(
      new CustomEvent('navigate-tab', {
        detail: { tab: 'victims', targetId: victimId }
      })
    );
  };

  const getStatusColor = (status: string) => {
    switch ((status || '').toLowerCase()) {
      case 'at_large':
      case 'searching':
      case 'wanted':
        return 'text-[#C94A2A] bg-[#C94A2A]/10 border-[#C94A2A]/20';
      case 'arrested':
        return 'text-[#D4820A] bg-[#D4820A]/10 border-[#D4820A]/20';
      case 'on_bail':
        return 'text-[#0E9E78] bg-[#0E9E78]/10 border-[#0E9E78]/20';
      case 'under_trial':
        return 'text-[#00BCD4] bg-[#00BCD4]/10 border-[#00BCD4]/20';
      case 'convicted':
        return 'text-[#1E6FD9] bg-[#1E6FD9]/10 border-[#1E6FD9]/20';
      case 'acquitted':
        return 'text-[#8B5CF6] bg-[#8B5CF6]/10 border-[#8B5CF6]/20';
      case 'deceased':
        return 'text-[var(--text-muted)] bg-[var(--bg-elevated)]/50 border-[var(--border-secondary)]';
      default:
        return 'text-[var(--text-primary)] bg-[var(--bg-tertiary)] border-[var(--border-primary)]';
    }
  };

  const formatStatusLabel = (status: string) => {
    switch ((status || '').toLowerCase()) {
      case 'at_large':
        return 'SEARCHING / WANTED';
      case 'searching':
        return 'SEARCHING';
      case 'wanted':
        return 'WANTED';
      case 'arrested':
        return 'ARRESTED';
      case 'on_bail':
        return 'ON BAIL';
      case 'under_trial':
        return 'UNDER TRIAL';
      case 'convicted':
        return 'CONVICTED';
      case 'acquitted':
        return 'ACQUITTED';
      case 'deceased':
        return 'DECEASED';
      default:
        return status ? status.replace(/_/g, ' ').toUpperCase() : 'UNKNOWN';
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!criminalDetails) return;
    try {
      setUpdatingStatus(true);
      await updateCriminal(criminalDetails.id, { status: newStatus });
      setCriminalDetails((prev: any) => (prev ? { ...prev, status: newStatus } : null));
      setCriminals((prev) =>
        prev.map((c) => (c.id === criminalDetails.id ? { ...c, status: newStatus } : c))
      );
      if (user) {
        addLog(
          user.name,
          user.badgeId,
          'UPDATE',
          `Updated criminal ${criminalDetails.full_name} status to ${formatStatusLabel(newStatus)}`
        );
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to update criminal status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const startEditProfile = () => {
    if (!criminalDetails) return;
    setProfileDraft({
      aliases: criminalDetails.aliases ?? '',
      date_of_birth: criminalDetails.date_of_birth ?? '',
      gender: criminalDetails.gender ?? '',
      identifying_marks: criminalDetails.identifying_marks ?? '',
      address: criminalDetails.address ?? '',
      mo_summary: criminalDetails.mo_summary ?? '',
      gang_affiliation: criminalDetails.gang_affiliation ?? '',
    });
    setEditingProfile(true);
  };

  const saveProfile = async () => {
    if (!criminalDetails || !user) return;
    try {
      setSavingProfile(true);
      const p: any = {};
      const eq = (a: any, b: any) => (a ?? '').trim() === (b ?? '').trim();
      if (!eq(profileDraft.aliases, criminalDetails.aliases)) p.aliases = profileDraft.aliases.trim() || null;
      if (profileDraft.date_of_birth !== (criminalDetails.date_of_birth ?? '')) p.date_of_birth = profileDraft.date_of_birth || null;
      if (profileDraft.gender !== (criminalDetails.gender ?? '')) p.gender = profileDraft.gender || null;
      if (!eq(profileDraft.identifying_marks, criminalDetails.identifying_marks)) p.identifying_marks = profileDraft.identifying_marks.trim() || null;
      if (!eq(profileDraft.address, criminalDetails.address)) p.address = profileDraft.address.trim() || null;
      if (!eq(profileDraft.mo_summary, criminalDetails.mo_summary)) p.mo_summary = profileDraft.mo_summary.trim() || null;
      if (!eq(profileDraft.gang_affiliation, criminalDetails.gang_affiliation)) p.gang_affiliation = profileDraft.gang_affiliation.trim() || null;

      const res = await updateCriminal(criminalDetails.id, p);
      setCriminalDetails((prev: any) => ({ ...prev, ...res }));
      setCriminals((prev) => prev.map((c) => (c.id === criminalDetails.id ? { ...c, ...res } : c)));
      addLog(user.name, user.badgeId, 'UPDATE', `Updated criminal profile for ${criminalDetails.full_name}`);
      setEditingProfile(false);
    } catch (err: any) {
      alert(err?.message || 'Failed to update criminal profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const getRiskBandColor = (band: string) => {
    switch (band?.toUpperCase()) {
      case 'CRITICAL':
        return 'text-red-500 border-red-500/30 bg-red-950/20';
      case 'HIGH':
        return 'text-amber-500 border-amber-500/30 bg-amber-950/20';
      case 'MEDIUM':
        return 'text-yellow-500 border-yellow-500/30 bg-yellow-950/20';
      case 'LOW':
        return 'text-emerald-500 border-emerald-500/30 bg-emerald-950/20';
      default:
        return 'text-[var(--text-muted)] border-[var(--border-secondary)] bg-[var(--bg-tertiary)]/50';
    }
  };

  // Helper for computing radial SVG graph coordinates
  const renderRelationshipGraph = () => {
    if (!criminalDetails?.network) return null;

    const { nodes = [], edges = [] } = criminalDetails.network;
    
    if (nodes.length === 0) {
      return (
        <div className="h-64 flex items-center justify-center border border-[var(--border-primary)] border-dashed rounded text-[var(--text-muted)] text-xs font-mono">
          No relationship linkages found
        </div>
      );
    }

    const width = 540;
    const height = 300;
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Find the center node
    const centerNodeId = `criminal-${selectedId}`;

    // Place other nodes radially
    const perimeterNodes = nodes.filter((n: any) => n.id !== centerNodeId);
    const radius = 100;
    
    const nodePositions: Record<string, { x: number; y: number }> = {};
    nodePositions[centerNodeId] = { x: centerX, y: centerY };

    perimeterNodes.forEach((node: any, idx: number) => {
      const angle = (idx * 2 * Math.PI) / perimeterNodes.length;
      nodePositions[node.id] = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      };
    });

    // Render nodes list
    return (
      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto bg-[var(--bg-secondary)]/50 rounded border border-[var(--border-primary)]">
          <defs>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Links */}
          {edges.map((edge: any, index: number) => {
            const start = nodePositions[edge.source];
            const end = nodePositions[edge.target];
            if (!start || !end) return null;

            return (
              <g key={`edge-${index}`}>
                <line
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  stroke="#1E6FD9"
                  strokeWidth="1"
                  strokeOpacity="0.4"
                  strokeDasharray="2 2"
                />
                {/* Labeled link indicator */}
                <text
                  x={(start.x + end.x) / 2}
                  y={(start.y + end.y) / 2 - 4}
                  fill="#6A7A96"
                  fontSize="6.5"
                  fontFamily="monospace"
                  textAnchor="middle"
                  className="select-none bg-[var(--bg-secondary)]"
                >
                  {edge.relationship}
                </text>
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map((node: any) => {
            const pos = nodePositions[node.id];
            if (!pos) return null;

            const isCenter = node.id === centerNodeId;
            let color = '#1E6FD9'; // default blue
            if (isCenter) color = '#C94A2A'; // crimson for subject
            else if (node.category === 'victim') color = '#0E9E78'; // teal for victims
            else if (node.category === 'location') color = '#D4820A'; // orange for locations
            else if (node.category === 'suspect') color = '#6C43CC'; // purple for suspects

            return (
              <g 
                key={node.id} 
                transform={`translate(${pos.x}, ${pos.y})`}
                className="cursor-pointer group"
                onClick={() => {
                  if (node.category === 'victim') {
                    const victimUuid = node.id.replace('victim-', '');
                    navigateToVictim(victimUuid);
                  } else if (node.id.startsWith('criminal-')) {
                    const criminalUuid = node.id.replace('criminal-', '');
                    handleSelectCriminal(criminalUuid);
                  }
                }}
                onMouseEnter={() => setHoveredNode(node)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                {/* Glow ring around center node */}
                {isCenter && (
                  <circle r="14" fill="none" stroke={color} strokeWidth="1.5" strokeOpacity="0.6" className="animate-pulse" filter="url(#glow)" />
                )}
                
                <circle 
                  r={isCenter ? '10' : '8'} 
                  fill={isCenter ? color : '#111D35'} 
                  stroke={color} 
                  strokeWidth="2" 
                  className="transition-transform duration-200 group-hover:scale-125"
                />

                <text
                  y={isCenter ? '24' : '18'}
                  className="font-bold select-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
                  fill="var(--text-primary)"
                  fontSize="7.5"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {node.name.split(' ')[0]}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover overlay panel */}
        {hoveredNode && (
          <div className="absolute top-2 left-2 bg-[var(--bg-secondary)]/90 border border-[var(--border-primary)] p-2.5 rounded font-mono text-[9px] text-[var(--text-secondary)] max-w-xs pointer-events-none select-none">
            <span className="text-[var(--text-primary)] font-bold block uppercase">{hoveredNode.name}</span>
            <span className="text-[var(--text-muted)] uppercase block mt-0.5">CATEGORY: {hoveredNode.category}</span>
            <span className="text-[var(--text-muted)] uppercase block">CASES CONNECTED: {hoveredNode.casesCount}</span>
            <div className="mt-1 border-t border-[var(--border-primary)] pt-1 text-[var(--text-secondary)] italic">{hoveredNode.details}</div>
          </div>
        )}
      </div>
    );
  };

  const filteredCriminals = criminals.filter((item) => {
    if (statusFilter === 'all') return true;
    const itemStatus = (item.status || '').toLowerCase();
    if (statusFilter === 'at_large') {
      return ['at_large', 'searching', 'wanted'].includes(itemStatus);
    }
    return itemStatus === statusFilter.toLowerCase();
  });

  return (
    <div className="min-h-[84vh] flex flex-col gap-5 p-1 md:p-3 select-none">
      
      {/* Page Header banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[var(--border-muted)] pb-3">
        <div>
          <h2 className="text-md font-mono font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-[#1E6FD9] animate-pulse" />
            {t.criminal_title}
          </h2>
          <p className="text-[9.5px] font-mono text-[var(--text-muted)] mt-0.5">
            {t.criminal_subtitle}
          </p>
        </div>

        {/* Back / Return to Investigation Button */}
        <button
          onClick={() => {
            const returnCaseId = sessionStorage.getItem('return_to_case_id');
            window.dispatchEvent(
              new CustomEvent('navigate-tab', {
                detail: { tab: 'investigation', targetId: returnCaseId || undefined },
              })
            );
          }}
          className="flex items-center gap-2 px-3.5 py-1.5 bg-[#1E6FD9]/15 hover:bg-[#1E6FD9]/25 text-[#1E6FD9] border border-[#1E6FD9]/40 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-xs self-start sm:self-auto"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>
            {t.action_back}
            {sessionStorage.getItem('return_to_case_number')
              ? ` (${sessionStorage.getItem('return_to_case_number')})`
              : ''}
          </span>
        </button>
      </div>

      <div className="flex-grow w-full grid grid-cols-1 lg:grid-cols-12 gap-5 overflow-hidden">
        
        {/* Left Search & Registry list drawer (Col: 4) */}
        <div className="lg:col-span-4 bg-[var(--bg-tertiary)]/30 border border-border-color p-4 rounded-card flex flex-col gap-3 overflow-hidden">
          <div className="flex flex-col gap-2 border-b border-[var(--border-primary)] pb-2 shrink-0">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-mono font-bold text-[var(--text-primary)] uppercase tracking-wider">Offender Indexes</span>
              <span className="text-[8.5px] font-mono text-[var(--text-muted)]">{filteredCriminals.length} RECORDED</span>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex-1 flex items-center relative text-xs">
                <input
                  type="text"
                  placeholder="Search dossiers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-7 pr-3 py-1 bg-[var(--bg-secondary)]/70 border border-border-color rounded text-[var(--text-primary)] outline-none focus:border-[#1E6FD9] font-mono text-[10px]"
                />
                <Search className="absolute left-2 w-3.5 h-3.5 text-[var(--text-muted)]" />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2 py-1 bg-[var(--bg-secondary)] border border-border-color rounded text-[9px] font-mono text-[var(--text-primary)] outline-none focus:border-[#1E6FD9] uppercase cursor-pointer"
              >
                <option value="all">ALL STATUSES</option>
                <option value="at_large">SEARCHING / WANTED</option>
                <option value="arrested">ARRESTED</option>
                <option value="on_bail">ON BAIL</option>
                <option value="under_trial">UNDER TRIAL</option>
                <option value="convicted">CONVICTED</option>
                <option value="acquitted">ACQUITTED</option>
                <option value="deceased">DECEASED</option>
              </select>
            </div>
          </div>

          {/* List scroll panel */}
          <div className="flex-grow overflow-y-auto pr-1 flex flex-col gap-2 custom-scrollbar">
            {loadingList ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="p-3 rounded border border-[var(--border-primary)] bg-[var(--bg-tertiary)]/50 flex justify-between items-center">
                    <div className="space-y-1.5">
                      <div className="sk-skeleton rounded-sm h-3 w-24" />
                      <div className="sk-skeleton rounded-sm h-2 w-16" />
                    </div>
                    <div className="sk-skeleton rounded h-4 w-12" />
                  </div>
                ))}
              </div>
            ) : filteredCriminals.length > 0 ? (
              filteredCriminals.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelectCriminal(item.id)}
                  className={`p-3 rounded text-left font-mono transition-all border flex justify-between items-center cursor-pointer ${
                    selectedId === item.id
                      ? 'bg-[#1E6FD9]/15 border-[#1E6FD9]/40 text-[#1E6FD9]'
                      : 'bg-[var(--bg-tertiary)]/50 border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/30'
                  }`}
                >
                  <div className="min-w-0">
                    <span className="block font-bold text-[10.5px] truncate">{item.full_name}</span>
                    <span className="text-[8px] text-[var(--text-muted)] block mt-0.5 truncate uppercase">
                      Alias: {item.aliases || 'No record'}
                    </span>
                  </div>
                  <span className={`text-[7.5px] px-1.5 py-0.5 rounded border uppercase font-bold shrink-0 ml-2 ${getStatusColor(item.status)}`}>
                    {formatStatusLabel(item.status)}
                  </span>
                </button>
              ))
            ) : (
              <div className="p-6 text-center text-[9.5px] font-mono text-[var(--text-muted)] uppercase border border-dashed border-[var(--border-primary)] rounded mt-4">
                No matching criminal records
              </div>
            )}
          </div>
        </div>

        {/* Right Dossier Panel (Col: 8) */}
        <div className="lg:col-span-8 bg-[var(--bg-secondary)] border border-border-color p-5 rounded-card flex flex-col gap-5 overflow-y-auto custom-scrollbar">
          
          {loadingDetails ? (
            <div className="h-full w-full flex items-center justify-center">
              <CardSkeleton />
            </div>
          ) : showIntelligence && criminalDetails ? (
            <IntelligenceWorkspace
              entityType="criminal"
              entityId={criminalDetails.id}
              entityLabel={criminalDetails.full_name}
              onClose={() => setShowIntelligence(false)}
            />
          ) : criminalDetails ? (
            <div className="space-y-6">
              
              {/* Offender Identity banner */}
              <div className="p-4 bg-[var(--bg-tertiary)]/40 border border-[var(--border-primary)] rounded flex flex-col md:flex-row gap-4 items-center md:items-start select-none">
                <div className="relative group shrink-0">
                  <PersonAvatar
                    imageUrl={criminalDetails.image_url}
                    name={criminalDetails.full_name}
                    size={88}
                    accentColor="#1E6FD9"
                    shape="square"
                  />
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    disabled={uploadingImage || !canWrite}
                    title={canWrite ? 'Upload photo' : 'Insufficient permissions'}
                    className={`absolute inset-0 flex items-end justify-center pb-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity ${canWrite ? 'cursor-pointer' : 'cursor-not-allowed'} disabled:cursor-wait`}
                    style={{ background: 'linear-gradient(to top, rgba(4,10,18,0.75) 40%, transparent)' }}
                  >
                    <span className="flex items-center gap-1 font-mono text-[8px] uppercase tracking-widest text-white">
                      {uploadingImage ? '…' : <><Camera className="w-2.5 h-2.5" /> Upload</>}
                    </span>
                  </button>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </div>
                
                <div className="flex-1 w-full text-center md:text-left">
                  <div className="flex flex-col md:flex-row md:justify-between items-center md:items-start gap-2">
                    <div>
                      <h3 className="text-sm font-extrabold text-[var(--text-primary)] uppercase tracking-wider">{criminalDetails.full_name}</h3>
                      <span className="text-[9.5px] text-[var(--text-secondary)] font-mono block mt-1 uppercase">
                        {editingProfile ? (
                          <input
                            type="text"
                            value={profileDraft.aliases || ''}
                            onChange={(e) => setProfileDraft((d) => ({ ...d, aliases: e.target.value }))}
                            placeholder="Aliases, comma separated"
                            className="w-full max-w-xs bg-[var(--bg-tertiary)]/50 border border-border-color rounded px-1.5 py-0.5 text-[var(--text-secondary)] outline-none focus:border-[#1E6FD9] font-mono text-[9px] normal-case"
                          />
                        ) : (
                          <>Aliases: {criminalDetails.aliases || 'No documented aliases'}</>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-center md:justify-end">
                      <button
                        onClick={() => setShowIntelligence(true)}
                        className="inline-flex items-center gap-1 text-[10px] bg-[#a855f7]/15 text-[#a855f7] px-2 py-1 rounded border border-[#a855f7]/30 hover:bg-[#a855f7]/30 transition-colors cursor-pointer"
                      >
                        <Brain className="w-3 h-3" /> {t.criminal_build_intelligence}
                      </button>
                      <button
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('open-ai-assistant', {
                            detail: { query: `Tell me about the criminal ${criminalDetails.full_name}. What is their status, risk level, network connections, and linked cases?` }
                          }));
                        }}
                        className="flex items-center gap-1 text-[10px] bg-[#1E6FD9]/15 text-[#1E6FD9] px-2 py-1 rounded border border-[#1E6FD9]/30 hover:bg-[#1E6FD9]/30 transition-colors cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3" /> Ask AI
                      </button>
                      
                      {/* Interactive Status Selector */}
                      <select
                        value={
                          ['searching', 'wanted', 'at_large'].includes((criminalDetails.status || '').toLowerCase())
                            ? 'at_large'
                            : (criminalDetails.status || 'at_large').toLowerCase()
                        }
                        onChange={(e) => handleStatusChange(e.target.value)}
                        disabled={updatingStatus || !canWrite}
                        title={canWrite ? 'Update Criminal Status' : 'Requires Investigator/Admin role'}
                        className={`text-[8.5px] px-2 py-1 rounded border uppercase font-bold tracking-wider cursor-pointer outline-none focus:ring-1 focus:ring-[#1E6FD9] transition-all ${getStatusColor(
                          criminalDetails.status
                        )} ${!canWrite ? 'cursor-not-allowed opacity-80' : ''}`}
                      >
                        <option value="at_large" className="bg-[var(--bg-secondary)] text-[#C94A2A]">
                          SEARCHING / WANTED
                        </option>
                        <option value="arrested" className="bg-[var(--bg-secondary)] text-[#D4820A]">
                          ARRESTED
                        </option>
                        <option value="on_bail" className="bg-[var(--bg-secondary)] text-[#0E9E78]">
                          ON BAIL
                        </option>
                        <option value="under_trial" className="bg-[var(--bg-secondary)] text-[#00BCD4]">
                          UNDER TRIAL
                        </option>
                        <option value="convicted" className="bg-[var(--bg-secondary)] text-[#1E6FD9]">
                          CONVICTED
                        </option>
                        <option value="acquitted" className="bg-[var(--bg-secondary)] text-[#8B5CF6]">
                          ACQUITTED
                        </option>
                        <option value="deceased" className="bg-[var(--bg-secondary)] text-[var(--text-muted)]">
                          DECEASED
                        </option>
                      </select>

                      {editingProfile ? (
                        <>
                          <button
                            onClick={saveProfile}
                            disabled={savingProfile}
                            className="inline-flex items-center gap-1 text-[10px] bg-[#0E9E78]/15 text-[#0E9E78] px-2 py-1 rounded border border-[#0E9E78]/30 hover:bg-[#0E9E78]/30 transition-colors cursor-pointer disabled:opacity-60"
                          >
                            {savingProfile ? '…' : <><Check className="w-3 h-3" /> Save Profile</>}
                          </button>
                          <button
                            onClick={() => setEditingProfile(false)}
                            title="Cancel editing"
                            className="inline-flex items-center gap-1 text-[10px] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] px-2 py-1 rounded border border-[var(--border-primary)] hover:bg-[var(--bg-elevated)]/30 transition-colors cursor-pointer"
                          >
                            <X className="w-3 h-3" /> Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={startEditProfile}
                          disabled={!canWrite}
                          title={canWrite ? 'Edit profile details (gender, birth date, aliases, etc.)' : 'Requires Investigator/Admin role'}
                          className="inline-flex items-center gap-1 text-[10px] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] px-2 py-1 rounded border border-[var(--border-primary)] hover:bg-[var(--bg-elevated)]/30 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          <Pencil className="w-3 h-3" /> Edit Profile
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mt-4 text-[9.5px] font-mono text-left">
                    <div className="p-2 bg-[var(--bg-secondary)]/60 border border-[var(--border-primary)] rounded">
                      <span className="text-[var(--text-muted)] uppercase text-[7.5px] block">Birth date</span>
                      {editingProfile ? (
                        <input
                          type="date"
                          value={profileDraft.date_of_birth || ''}
                          onChange={(e) => setProfileDraft((d) => ({ ...d, date_of_birth: e.target.value }))}
                          className="w-full mt-0.5 bg-[var(--bg-tertiary)]/50 border border-border-color rounded px-1 py-0.5 text-[var(--text-primary)] outline-none focus:border-[#1E6FD9] font-mono text-[9px]"
                        />
                      ) : (
                        <span className="text-[var(--text-primary)] block mt-0.5">{criminalDetails.date_of_birth || 'UNKNOWN'}</span>
                      )}
                    </div>
                    <div className="p-2 bg-[var(--bg-secondary)]/60 border border-[var(--border-primary)] rounded">
                      <span className="text-[var(--text-muted)] uppercase text-[7.5px] block">Gender</span>
                      {editingProfile ? (
                        <select
                          value={profileDraft.gender || ''}
                          onChange={(e) => setProfileDraft((d) => ({ ...d, gender: e.target.value }))}
                          className="w-full mt-0.5 bg-[var(--bg-tertiary)]/50 border border-border-color rounded px-1 py-0.5 text-[var(--text-primary)] outline-none focus:border-[#1E6FD9] font-mono text-[9px] uppercase cursor-pointer"
                        >
                          <option value="">UNKNOWN</option>
                          <option value="Male">MALE</option>
                          <option value="Female">FEMALE</option>
                          <option value="Other">OTHER</option>
                        </select>
                      ) : (
                        <span className="text-[var(--text-primary)] block mt-0.5 uppercase">{criminalDetails.gender || 'UNKNOWN'}</span>
                      )}
                    </div>
                    <div className="p-2 bg-[var(--bg-secondary)]/60 border border-[var(--border-primary)] rounded col-span-2">
                      <span className="text-[var(--text-muted)] uppercase text-[7.5px] block">identifying marks</span>
                      {editingProfile ? (
                        <input
                          type="text"
                          value={profileDraft.identifying_marks || ''}
                          onChange={(e) => setProfileDraft((d) => ({ ...d, identifying_marks: e.target.value }))}
                          placeholder="e.g. Scar on left cheek"
                          className="w-full mt-0.5 bg-[var(--bg-tertiary)]/50 border border-border-color rounded px-1 py-0.5 text-[var(--text-primary)] outline-none focus:border-[#1E6FD9] font-mono text-[9px]"
                        />
                      ) : (
                        <span className="text-[var(--text-primary)] block mt-0.5 truncate">{criminalDetails.identifying_marks || 'NONE RECORDED'}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {imageUploadError && (
                <p className="-mt-3 text-[9px] font-mono text-[#C94A2A]" role="alert">{imageUploadError}</p>
              )}

              {/* Bio summary & Address */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
                <div className="p-3.5 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded flex flex-col gap-1.5 text-left">
                  <span className="text-[#1E6FD9] uppercase font-bold text-[8.5px] tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" /> Modus Operandi summary
                  </span>
                  {editingProfile ? (
                    <textarea
                      value={profileDraft.mo_summary || ''}
                      onChange={(e) => setProfileDraft((d) => ({ ...d, mo_summary: e.target.value }))}
                      rows={3}
                      placeholder="Describe known pattern of offending..."
                      className="bg-[var(--bg-tertiary)]/10 border border-[var(--border-primary)]/40 rounded p-1.5 text-[var(--text-secondary)] leading-relaxed text-[10px] outline-none focus:border-[#1E6FD9] font-mono resize-y"
                    />
                  ) : (
                    <p className="text-[var(--text-secondary)] leading-relaxed text-[10px] bg-[var(--bg-tertiary)]/10 p-1.5 border border-[var(--border-primary)]/40 rounded">
                      {criminalDetails.mo_summary || 'No recorded MO summaries for linked incidents.'}
                    </p>
                  )}
                </div>
                <div className="p-3.5 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded flex flex-col gap-1.5 text-left">
                  <span className="text-[#1E6FD9] uppercase font-bold text-[8.5px] tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" /> Registered Residence Address
                  </span>
                  {editingProfile ? (
                    <textarea
                      value={profileDraft.address || ''}
                      onChange={(e) => setProfileDraft((d) => ({ ...d, address: e.target.value }))}
                      rows={3}
                      placeholder="Registered legal residence address..."
                      className="bg-[var(--bg-tertiary)]/10 border border-[var(--border-primary)]/40 rounded p-1.5 text-[var(--text-secondary)] leading-relaxed text-[10px] outline-none focus:border-[#1E6FD9] font-mono resize-y"
                    />
                  ) : (
                    <p className="text-[var(--text-secondary)] leading-relaxed text-[10px] bg-[var(--bg-tertiary)]/10 p-1.5 border border-[var(--border-primary)]/40 rounded">
                      {criminalDetails.address || 'No registered legal residence address reported.'}
                    </p>
                  )}
                </div>
              </div>

              {/* AI Predictive Intelligence Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* AI Risk Score Widget */}
                {criminalDetails.ai_risk && (
                  <div className="p-4 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded flex flex-col gap-3 text-left">
                    <div className="flex justify-between items-center border-b border-[var(--border-primary)] pb-2">
                      <span className="text-[#1E6FD9] font-mono font-bold text-[8.5px] tracking-wider uppercase flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5" /> AI Risk Profile Scorer
                      </span>
                      <span className="text-[7.5px] font-mono font-bold text-[var(--text-muted)] uppercase">
                        CONFIDENCE: {Math.round((criminalDetails.ai_risk.confidence || 0.72) * 100)}%
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Radial indicator */}
                      <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle cx="32" cy="32" r="28" fill="transparent" stroke="#111D35" strokeWidth="4" />
                          <circle 
                            cx="32" 
                            cy="32" 
                            r="28" 
                            fill="transparent" 
                            stroke={criminalDetails.ai_risk.risk_score > 75 ? '#C94A2A' : '#1E6FD9'} 
                            strokeWidth="4" 
                            strokeDasharray={2 * Math.PI * 28}
                            strokeDashoffset={2 * Math.PI * 28 * (1 - (criminalDetails.ai_risk.risk_score || 45) / 100)}
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="absolute font-mono font-bold text-xs text-[var(--text-primary)]">
                          {criminalDetails.ai_risk.risk_score}%
                        </span>
                      </div>

                      <div className="flex-grow font-mono">
                        <span className={`inline-block text-[8px] px-1.5 py-0.5 border rounded font-bold uppercase ${getRiskBandColor(criminalDetails.ai_risk.risk_band)}`}>
                          {criminalDetails.ai_risk.risk_band || 'MEDIUM'}
                        </span>
                        <div className="mt-2 text-[8px] text-[var(--text-muted)] uppercase font-bold">Top risk factors:</div>
                        <ul className="list-disc pl-3 text-[9px] text-[var(--text-secondary)] mt-1 space-y-0.5">
                          {criminalDetails.ai_risk.top_factors?.map((f: any, i: number) => (
                            <li key={i}>
                              {typeof f === 'object' && f !== null 
                                ? `${f.feature || ''} (contribution: ${typeof f.contribution === 'number' ? f.contribution.toFixed(1) : f.contribution})`
                                : f}
                            </li>
                          )) || <li>No immediate anomalies flagged</li>}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Repeat Offender Widget */}
                {criminalDetails.ai_repeat && (
                  <div className="p-4 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded flex flex-col gap-3 text-left">
                    <div className="flex justify-between items-center border-b border-[var(--border-primary)] pb-2">
                      <span className="text-[#1E6FD9] font-mono font-bold text-[8.5px] tracking-wider uppercase flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5" /> Recidivism indexer
                      </span>
                      {criminalDetails.ai_repeat.will_reoffend && (
                        <span className="text-[7.5px] px-1.5 py-0.5 bg-red-950/20 text-red-500 border border-red-900/40 rounded font-bold uppercase tracking-wider animate-pulse flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" /> Repeat Offender
                        </span>
                      )}
                    </div>

                    <div className="flex-grow flex flex-col justify-between font-mono">
                      <div className="flex justify-between text-[10px] text-[var(--text-muted)]">
                        <span>Re-offense Probability:</span>
                        <span className="font-bold text-[var(--text-primary)]">
                          {Math.round((criminalDetails.ai_repeat.probability || 0.3) * 100)}%
                        </span>
                      </div>
                      <div className="w-full bg-[var(--bg-tertiary)] h-1.5 rounded-full overflow-hidden mt-1.5">
                        <div 
                          className={`h-full rounded-full ${criminalDetails.ai_repeat.will_reoffend ? 'bg-[#C94A2A]' : 'bg-[#0E9E78]'}`}
                          style={{ width: `${(criminalDetails.ai_repeat.probability || 0.3) * 100}%` }}
                        />
                      </div>

                      <div className="mt-3">
                        <span className="text-[8px] text-[var(--text-muted)] uppercase font-bold block">Analysis triggers:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {criminalDetails.ai_repeat.risk_factors?.map((f: any, i: number) => (
                            <span key={i} className="text-[8px] bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-muted)] px-1.5 py-0.5 rounded">
                              {typeof f === 'object' && f !== null ? f.feature : f}
                            </span>
                          )) || <span className="text-[8px] text-[var(--text-secondary)] italic">No triggers registered</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* Similar Offenders Recommendations */}
              {criminalDetails.ai_similar?.similar?.length > 0 && (
                <div className="p-4 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded text-left select-none">
                  <span className="text-[#1E6FD9] font-mono font-bold text-[8.5px] tracking-wider uppercase block border-b border-[var(--border-primary)] pb-2">
                    <Users className="w-3.5 h-3.5 inline mr-1.5" /> Behaviourally similar offenders
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                    {criminalDetails.ai_similar.similar.map((sim: any) => (
                      <button
                        key={sim.criminal_id}
                        onClick={() => handleSelectCriminal(sim.criminal_id)}
                        className="p-2.5 bg-[var(--bg-tertiary)]/50 hover:bg-[#1E6FD9]/5 border border-[var(--border-primary)] hover:border-[#1E6FD9]/30 rounded font-mono text-left cursor-pointer transition-all flex flex-col justify-between"
                      >
                        <div>
                          <span className="text-[10px] text-[var(--text-primary)] font-bold block truncate">{sim.name}</span>
                          {sim.matching_factors && sim.matching_factors.length > 0 && (
                            <span className="text-[7px] text-emerald-400 block mt-1 line-clamp-1">
                              ✓ {sim.matching_factors[0]}
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between items-center mt-2.5">
                          <span className="text-[8px] text-[#0E9E78] font-bold">
                            {Math.round((sim.similarity || 0.6) * 100)}% Match
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-[var(--text-secondary)] group-hover:text-[#1E6FD9]" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Related Cases Section */}
              <div className="p-4 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded text-left">
                <span className="text-[#1E6FD9] font-mono font-bold text-[8.5px] tracking-wider uppercase block border-b border-[var(--border-primary)] pb-2">
                  <FileText className="w-3.5 h-3.5 inline mr-1.5" /> Associated Case history (FIR Links)
                </span>
                
                <div className="mt-3 overflow-x-auto">
                  {criminalDetails.firs?.length > 0 ? (
                    <table className="w-full font-mono text-[9px] text-[var(--text-secondary)]">
                      <thead>
                        <tr className="border-b border-[var(--border-primary)] text-[var(--text-muted)]">
                          <th className="py-2 text-left">FIR No</th>
                          <th className="py-2 text-left">Complainant</th>
                          <th className="py-2 text-left">BNS/IPC sections</th>
                          <th className="py-2 text-left">Filed date</th>
                          <th className="py-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {criminalDetails.firs.map((fir: any) => (
                          <tr key={fir.id} className="border-b border-[var(--border-primary)]/40 hover:bg-[var(--bg-tertiary)]/20">
                            <td className="py-2 text-[var(--text-primary)] font-bold">{fir.fir_number}</td>
                            <td className="py-2">{fir.complainant_name}</td>
                            <td className="py-2 text-[var(--text-muted)]">{fir.sections || 'N/A'}</td>
                            <td className="py-2">{fir.filed_at ? new Date(fir.filed_at).toLocaleDateString() : 'N/A'}</td>
                            <td className="py-2 text-right">
                              <button 
                                onClick={() => {
                                  window.dispatchEvent(
                                    new CustomEvent('navigate-tab', {
                                      detail: { tab: 'fir', targetId: fir.id }
                                    })
                                  );
                                }}
                                className="text-[#1E6FD9] hover:underline flex items-center justify-end gap-1 font-bold cursor-pointer"
                              >
                                View <ExternalLink className="w-2.5 h-2.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="py-4 text-center text-[var(--text-secondary)] text-[9px] uppercase border border-dashed border-[var(--border-primary)] rounded">
                      No linked case registry items found.
                    </div>
                  )}
                </div>
              </div>

              {/* Relationship Viewer Section */}
              <div className="p-4 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded text-left">
                <div className="flex justify-between items-center border-b border-[var(--border-primary)] pb-2">
                  <span className="text-[#1E6FD9] font-mono font-bold text-[8.5px] tracking-wider uppercase">
                    <Activity className="w-3.5 h-3.5 inline mr-1.5" /> Associate & Scene Network Diagram
                  </span>
                  <div className="flex gap-2.5 text-[7px] font-mono text-[var(--text-muted)] uppercase select-none">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#C94A2A]" /> Subject</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#6C43CC]" /> Suspect</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#0E9E78]" /> Victim</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#D4820A]" /> Location</span>
                  </div>
                </div>
                <div className="mt-3">
                  {renderRelationshipGraph()}
                  <span className="text-[7.5px] text-[var(--text-secondary)] font-mono block mt-1.5 uppercase italic text-center">
                    Interact: Hover nodes to read dossier metadata; click suspect or victim nodes to jump profile
                  </span>
                </div>
              </div>

            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-[var(--text-secondary)] font-mono text-[9.5px] uppercase">
              No profile highlights selected.
            </div>
          )}
        </div>

      </div>

    </div>
  );
};

export default Criminals;
