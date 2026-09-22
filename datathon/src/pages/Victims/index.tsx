import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useAuditStore } from '../../store/auditStore';
import { usePolling } from '../../hooks/usePolling';
import {
  listVictims,
  getVictim,
  updateVictim,
} from '../../services/api';
import type { VictimRecord } from '../../services/api';
import {
  Search,
  Heart,
  Activity,
  MapPin,
  FileText,
  Phone,
  ExternalLink,
  BarChart3,
  Pencil,
  Save,
  X,
  Loader2,
} from 'lucide-react';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { VictimologyPanel } from './VictimologyPanel';
import { PersonAvatar } from '../../components/ui/PersonAvatar';

interface VictimSummary {
  id: string;
  full_name: string;
  contact_number: string | null;
  address: string | null;
  gender: string | null;
  age: number | null;
}

export const Victims: React.FC = () => {
  const { user } = useAuthStore();
  const { addLog } = useAuditStore();

  const [victims, setVictims] = useState<VictimSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loadingList, setLoadingList] = useState<boolean>(false);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);
  const [victimDetails, setVictimDetails] = useState<any>(null);
  const [hoveredNode, setHoveredNode] = useState<any>(null);
  const [showVictimology, setShowVictimology] = useState<boolean>(false);

  // Edit modal state
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<VictimRecord>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editNotice, setEditNotice] = useState<string | null>(null);
  const canEditVictim = user?.role === 'ADMIN' || user?.role === 'IO';

  const startEdit = () => {
    if (!victimDetails) return;
    setEditForm({
      full_name: victimDetails.full_name,
      contact_number: victimDetails.contact_number,
      address: victimDetails.address,
      gender: victimDetails.gender,
      age: victimDetails.age,
      statement: victimDetails.statement,
      image_url: victimDetails.image_url,
    });
    setEditError(null);
    setEditNotice(null);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!victimDetails || !editForm.full_name?.trim()) {
      setEditError('Full name is required.');
      return;
    }
    setSavingEdit(true);
    setEditError(null);
    setEditNotice(null);
    try {
      await updateVictim(victimDetails.id, editForm);
      setEditNotice('Victim dossier updated.');
      setEditing(false);
      const refreshed = await getVictim(victimDetails.id);
      setVictimDetails(refreshed);
      const res = await listVictims(searchQuery);
      setVictims(res.results || []);
      if (user) {
        addLog(user.name, user.badgeId, 'UPDATE', `Updated victim dossier for: ${editForm.full_name} (${victimDetails.id})`);
      }
    } catch (err: any) {
      setEditError(err?.message || 'Failed to update victim dossier.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Load victims on mount or search
  useEffect(() => {
    let isMounted = true;
    setLoadingList(true);
    
    // Check if there is a target ID from redirect session
    const redirectId = sessionStorage.getItem('selected_entity_id');
    
    listVictims(searchQuery)
      .then((res) => {
        if (!isMounted) return;
        setVictims(res.results || []);
        
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
        console.error('Failed to load victim records:', err.message);
      })
      .finally(() => {
        if (isMounted) setLoadingList(false);
      });

    return () => {
      isMounted = false;
    };
  }, [searchQuery]);

  // Background polling: silently refresh victim list every 30s
  usePolling(async () => {
    try {
      const res = await listVictims(searchQuery);
      setVictims(res.results || []);
    } catch { /* silent */ }
  }, 30000);

  // Load victim details when selectedId changes
  useEffect(() => {
    if (!selectedId) return;
    let isMounted = true;
    setLoadingDetails(true);

    getVictim(selectedId)
      .then((res) => {
        if (!isMounted) return;
        setVictimDetails(res);
        
        // Log access audit
        if (user) {
          addLog(
            user.name,
            user.badgeId,
            'REVIEW',
            `Accessed victim file for: ${res.full_name} (${res.id})`
          );
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Failed to load victim details:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingDetails(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedId, user]);

  const handleSelectVictim = (id: string) => {
    setSelectedId(id);
  };

  const navigateToCriminal = (criminalId: string) => {
    window.dispatchEvent(
      new CustomEvent('navigate-tab', {
        detail: { tab: 'criminals', targetId: criminalId }
      })
    );
  };

  // Helper for computing radial SVG graph coordinates
  const renderRelationshipGraph = () => {
    if (!victimDetails?.network) return null;

    const { nodes = [], edges = [] } = victimDetails.network;
    
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
    
    // Find the center node (victim)
    const centerNodeId = `victim-${selectedId}`;

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
                  stroke="#0E9E78"
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
            let color = '#0E9E78'; // teal for victim
            if (isCenter) color = '#0E9E78';
            else if (node.category === 'location') color = '#D4820A'; // orange for locations
            else if (node.category === 'suspect' || node.category === 'offender') color = '#C94A2A'; // red for offenders
            else if (node.category === 'victim') color = '#1E6FD9'; // blue for other victims

            return (
              <g 
                key={node.id} 
                transform={`translate(${pos.x}, ${pos.y})`}
                className="cursor-pointer group"
                onClick={() => {
                  if (node.id.startsWith('criminal-')) {
                    const criminalUuid = node.id.replace('criminal-', '');
                    navigateToCriminal(criminalUuid);
                  } else if (node.id.startsWith('victim-')) {
                    const victimUuid = node.id.replace('victim-', '');
                    handleSelectVictim(victimUuid);
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

  return (
    <div className="min-h-[84vh] flex flex-col gap-5 p-1 md:p-3 select-none">
      
      {/* Page Header banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-[var(--border-muted)] pb-3">
        <div>
          <h2 className="text-md font-mono font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
            <Heart className="w-5 h-5 text-[#0E9E78] animate-pulse" />
            Victims & Witness Dossiers
          </h2>
          <p className="text-[9.5px] font-mono text-[var(--text-muted)] mt-0.5">
            CLASSIFIED VICTIM INDEX — SECURE PROFILE REGISTRY & INTEGRATED CASE RELATIONS
          </p>
        </div>
        <button
          onClick={() => setShowVictimology((current) => !current)}
          className={`inline-flex items-center gap-1.5 rounded px-3 py-2 text-[10px] font-bold uppercase tracking-wider border transition-colors cursor-pointer ${
            showVictimology
              ? 'border-[#0E9E78] bg-[#0E9E78]/20 text-[#0E9E78]'
              : 'border-border-color bg-[var(--bg-tertiary)]/35 text-[var(--text-secondary)] hover:border-[#0E9E78]/50'
          }`}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          {showVictimology ? 'Back to Dossiers' : 'Victimology Analytics'}
        </button>
      </div>

      <div className="flex-grow w-full grid grid-cols-1 lg:grid-cols-12 gap-5 overflow-hidden">
        
        {/* Left Search & Registry list drawer (Col: 4) */}
        <div className="lg:col-span-4 bg-[var(--bg-tertiary)]/30 border border-border-color p-4 rounded-card flex flex-col gap-4 overflow-hidden">
          <div className="flex justify-between items-center border-b border-[var(--border-primary)] pb-2 shrink-0">
            <span className="text-[10px] font-mono font-bold text-[var(--text-primary)] uppercase tracking-wider">Victims Registry</span>
            <div className="w-44 flex items-center relative text-xs">
              <input
                type="text"
                placeholder="Search victims..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-3 py-1 bg-[var(--bg-secondary)]/70 border border-border-color rounded text-[var(--text-primary)] outline-none focus:border-[#0E9E78] font-mono text-[10px]"
              />
              <Search className="absolute left-2 w-3.5 h-3.5 text-[var(--text-muted)]" />
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
                    <div className="sk-skeleton rounded h-3 w-10" />
                  </div>
                ))}
              </div>
            ) : victims.length > 0 ? (
              victims.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelectVictim(item.id)}
                  className={`p-3 rounded text-left font-mono transition-all border flex justify-between items-center cursor-pointer ${
                    selectedId === item.id
                      ? 'bg-[#0E9E78]/15 border-[#0E9E78]/40 text-[#0E9E78]'
                      : 'bg-[var(--bg-tertiary)]/50 border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/30'
                  }`}
                >
                  <div className="min-w-0">
                    <span className="block font-bold text-[10.5px] truncate">{item.full_name}</span>
                    <span className="text-[8px] text-[var(--text-muted)] block mt-0.5 truncate uppercase">
                      Contact: {item.contact_number || 'No contact'}
                    </span>
                  </div>
                  <span className="text-[7.5px] text-[var(--text-muted)] font-bold font-mono">
                    AGE: {item.age || 'N/A'}
                  </span>
                </button>
              ))
            ) : (
              <div className="p-6 text-center text-[9.5px] font-mono text-[var(--text-muted)] uppercase border border-dashed border-[var(--border-primary)] rounded mt-4">
                No matching victim records
              </div>
            )}
          </div>
        </div>

        {/* Right Dossier / Victimology Panel (Col: 8) */}
        <div className="lg:col-span-8 bg-[var(--bg-secondary)] border border-border-color p-5 rounded-card flex flex-col gap-5 overflow-y-auto custom-scrollbar">
          
          {showVictimology ? (
            <VictimologyPanel />
          ) : loadingDetails ? (
            <div className="h-full w-full flex items-center justify-center">
              <CardSkeleton />
            </div>
          ) : victimDetails ? (
            <div className="space-y-6">
              
              {/* Victim Identity banner */}
              <div className="p-4 bg-[var(--bg-tertiary)]/40 border border-[var(--border-primary)] rounded flex flex-col md:flex-row gap-4 items-center md:items-start select-none">
                <PersonAvatar
                  imageUrl={victimDetails.image_url}
                  name={victimDetails.full_name}
                  size={72}
                  accentColor="#0E9E78"
                  shape="circle"
                />
                
                <div className="flex-1 w-full text-center md:text-left font-mono">
                  <div className="flex flex-col md:flex-row md:justify-between items-center md:items-start gap-2">
                    <div>
                      <h3 className="text-sm font-extrabold text-[var(--text-primary)] uppercase tracking-wider">{victimDetails.full_name}</h3>
                      <span className="text-[9.5px] text-[var(--text-secondary)] block mt-1 uppercase">
                        VICTIM REGISTRY ID: {victimDetails.id}
                      </span>
                    </div>
                    {canEditVictim && (
                      <button
                        onClick={startEdit}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[var(--border-primary)] text-[9px] font-mono uppercase font-bold text-[#0E9E78] hover:bg-[#0E9E78]/10 cursor-pointer transition-colors"
                      >
                        <Pencil className="w-3 h-3" /> Edit Dossier
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mt-4 text-[9.5px]">
                    <div className="p-2 bg-[var(--bg-secondary)]/60 border border-[var(--border-primary)] rounded">
                      <span className="text-[var(--text-muted)] uppercase text-[7.5px] block">Age</span>
                      <span className="text-[var(--text-primary)] block mt-0.5">{victimDetails.age || 'UNKNOWN'}</span>
                    </div>
                    <div className="p-2 bg-[var(--bg-secondary)]/60 border border-[var(--border-primary)] rounded">
                      <span className="text-[var(--text-muted)] uppercase text-[7.5px] block">Gender</span>
                      <span className="text-[var(--text-primary)] block mt-0.5 uppercase">{victimDetails.gender || 'UNKNOWN'}</span>
                    </div>
                    <div className="p-2 bg-[var(--bg-secondary)]/60 border border-[var(--border-primary)] rounded col-span-2">
                      <span className="text-[var(--text-muted)] uppercase text-[7.5px] block">Contact Number</span>
                      <span className="text-[var(--text-primary)] block mt-0.5 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-[#0E9E78]" /> {victimDetails.contact_number || 'NONE REPORTED'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Address card */}
              <div className="p-3.5 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded flex flex-col gap-1.5 text-left font-mono text-xs">
                <span className="text-[#0E9E78] uppercase font-bold text-[8.5px] tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Registered Residence Address
                </span>
                <p className="text-[var(--text-secondary)] leading-relaxed text-[10px] bg-[var(--bg-tertiary)]/10 p-1.5 border border-[var(--border-primary)]/40 rounded">
                  {victimDetails.address || 'No residence address reported in dossier.'}
                </p>
              </div>

              {/* Victim/Witness Statement Card */}
              <div className="p-4 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded text-left font-mono">
                <span className="text-[#0E9E78] uppercase font-bold text-[8.5px] tracking-wider flex items-center gap-1.5 border-b border-[var(--border-primary)] pb-2">
                  <FileText className="w-3.5 h-3.5" /> Official Victim / Witness Statement
                </span>
                <p className="text-[var(--text-secondary)] leading-relaxed text-[10.5px] bg-[var(--bg-tertiary)]/15 p-3 border border-[var(--border-primary)]/50 rounded mt-3 whitespace-pre-line italic">
                  "{victimDetails.statement || 'No official narrative statement recorded for this profile.'}"
                </p>
              </div>

              {/* Related Cases Section */}
              <div className="p-4 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded text-left">
                <span className="text-[#0E9E78] font-mono font-bold text-[8.5px] tracking-wider uppercase block border-b border-[var(--border-primary)] pb-2">
                  <FileText className="w-3.5 h-3.5 inline mr-1.5" /> Linked Case history (FIR connections)
                </span>
                
                <div className="mt-3 overflow-x-auto font-mono">
                  {victimDetails.firs?.length > 0 ? (
                    <table className="w-full text-[9px] text-[var(--text-secondary)]">
                      <thead>
                        <tr className="border-b border-[var(--border-primary)] text-[var(--text-muted)]">
                          <th className="py-2 text-left">FIR No</th>
                          <th className="py-2 text-left">BNS/IPC sections</th>
                          <th className="py-2 text-left">Filed date</th>
                          <th className="py-2 text-left">Status</th>
                          <th className="py-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {victimDetails.firs.map((fir: any) => (
                          <tr key={fir.id} className="border-b border-[var(--border-primary)]/40 hover:bg-[var(--bg-tertiary)]/20">
                            <td className="py-2 text-[var(--text-primary)] font-bold">{fir.fir_number}</td>
                            <td className="py-2 text-[var(--text-muted)]">{fir.sections || 'N/A'}</td>
                            <td className="py-2">{fir.filed_at ? new Date(fir.filed_at).toLocaleDateString() : 'N/A'}</td>
                            <td className="py-2 font-bold uppercase">{fir.status}</td>
                            <td className="py-2 text-right">
                              <button 
                                onClick={() => {
                                  window.dispatchEvent(
                                    new CustomEvent('navigate-tab', {
                                      detail: { tab: 'fir', targetId: fir.id }
                                    })
                                  );
                                }}
                                className="text-[#0E9E78] hover:underline flex items-center justify-end gap-1 font-bold cursor-pointer"
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
                  <span className="text-[#0E9E78] font-mono font-bold text-[8.5px] tracking-wider uppercase">
                    <Activity className="w-3.5 h-3.5 inline mr-1.5" /> Associate & Scene Network Diagram
                  </span>
                  <div className="flex gap-2.5 text-[7px] font-mono text-[var(--text-muted)] uppercase select-none">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#0E9E78]" /> Subject</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#C94A2A]" /> Suspect</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#1E6FD9]" /> Victim</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#D4820A]" /> Location</span>
                  </div>
                </div>
                <div className="mt-3">
                  {renderRelationshipGraph()}
                  <span className="text-[7.5px] text-[var(--text-secondary)] font-mono block mt-1.5 uppercase italic text-center">
                    Interact: Hover nodes to read dossier metadata; click suspect nodes to load criminal dossier
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

      {/* ── Edit Dossier Modal ── */}
      {editing && (
        <div className="fixed inset-0 z-[400] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !savingEdit && setEditing(false)} />
          <div className="relative w-full sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--text-primary)]">
                <Pencil className="w-3.5 h-3.5 inline mr-1.5 text-[#0E9E78]" /> Edit Victim Dossier
              </span>
              <button onClick={() => setEditing(false)} disabled={savingEdit} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <Field label="Full Name">
                <input
                  type="text"
                  value={editForm.full_name || ''}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-xs outline-none focus:border-[#0E9E78]"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Age">
                  <input
                    type="number"
                    min={0}
                    value={editForm.age ?? ''}
                    onChange={(e) => setEditForm({ ...editForm, age: e.target.value === '' ? null : Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-xs outline-none focus:border-[#0E9E78]"
                  />
                </Field>
                <Field label="Gender">
                  <select
                    value={editForm.gender || ''}
                    onChange={(e) => setEditForm({ ...editForm, gender: e.target.value || null })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-xs outline-none focus:border-[#0E9E78] cursor-pointer"
                  >
                    <option value="">Unknown</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </Field>
              </div>
              <Field label="Contact Number">
                <input
                  type="text"
                  value={editForm.contact_number || ''}
                  onChange={(e) => setEditForm({ ...editForm, contact_number: e.target.value || null })}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-xs outline-none focus:border-[#0E9E78]"
                />
              </Field>
              <Field label="Residence Address">
                <input
                  type="text"
                  value={editForm.address || ''}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value || null })}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-xs outline-none focus:border-[#0E9E78]"
                />
              </Field>
              <Field label="Statement">
                <textarea
                  rows={4}
                  value={editForm.statement || ''}
                  onChange={(e) => setEditForm({ ...editForm, statement: e.target.value || null })}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-xs outline-none focus:border-[#0E9E78] resize-none"
                />
              </Field>
              <Field label="Photo URL">
                <input
                  type="text"
                  value={editForm.image_url || ''}
                  onChange={(e) => setEditForm({ ...editForm, image_url: e.target.value || null })}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-xs outline-none focus:border-[#0E9E78]"
                />
              </Field>
            </div>

            {editError && <p className="text-[10px] font-mono text-amber-400 mt-3">{editError}</p>}
            {editNotice && <p className="text-[10px] font-mono text-[#0E9E78] mt-3">{editNotice}</p>}

            <button
              onClick={saveEdit}
              disabled={savingEdit}
              className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#0E9E78] text-white text-xs font-semibold hover:opacity-90 disabled:opacity-40 cursor-pointer"
            >
              {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {savingEdit ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <span className="block text-[8.5px] font-mono uppercase tracking-wider text-[var(--text-muted)] mb-1">{label}</span>
    {children}
  </div>
);

export default Victims;
