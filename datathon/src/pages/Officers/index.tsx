import React, { useState, useEffect } from 'react';
import { useRBAC } from '../../hooks/useRBAC';
import { usePolling } from '../../hooks/usePolling';
import { Search, Plus, ShieldCheck, Mail, Phone, Edit, Trash2 } from 'lucide-react';
import { apiRequest } from '../../services/api';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { PersonAvatar } from '../../components/ui/PersonAvatar';

interface Officer {
  id: string;
  badge_number: string;
  name: string;
  rank: string | null;
  district: string | null;
  station: string;
  designation: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  image_url: string | null;
}

const OfficersPage: React.FC = () => {
  const { isAdmin } = useRBAC();
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentOfficer, setCurrentOfficer] = useState<Partial<Officer>>({
    name: '', badge_number: '', rank: '', district: '', station: '', designation: '', phone: '', email: '', status: 'active'
  });

  const fetchOfficers = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<{ results: Officer[] }>(`/officers?search=${search}`);
      setOfficers(data.results || []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch officers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOfficers();
  }, [search]);

  // Background polling: silently refresh officer list every 30s
  usePolling(async () => {
    try {
      const data = await apiRequest<{ results: Officer[] }>(`/officers?search=${search}`);
      setOfficers(data.results || []);
      setError(null);
    } catch { /* silent */ }
  }, 30000);

  const handleSave = async () => {
    if (!currentOfficer.name?.trim() || !currentOfficer.badge_number?.trim() || !currentOfficer.station?.trim()) {
      setError('Name, badge number, and station are required.');
      return;
    }

    try {
      const method = isEditMode ? 'PUT' : 'POST';
      const path = isEditMode ? `/officers/${currentOfficer.id}` : `/officers`;
      
      const payload = { ...currentOfficer };
      delete payload.id;
      
      // Normalize empty strings to null for optional fields
      Object.keys(payload).forEach(key => {
        if (payload[key as keyof typeof payload] === '') {
          payload[key as keyof typeof payload] = null;
        }
      });

      await apiRequest(path, {
        method,
        body: JSON.stringify(payload)
      });
      
      setIsFormOpen(false);
      setError(null);
      void fetchOfficers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save officer');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this officer?")) return;
    try {
      await apiRequest(`/officers/${id}`, { method: 'DELETE' });
      void fetchOfficers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete officer');
    }
  };

  const openEdit = (o: Officer) => {
    setCurrentOfficer(o);
    setIsEditMode(true);
    setIsFormOpen(true);
  };

  const openCreate = () => {
    setCurrentOfficer({ name: '', badge_number: '', rank: '', district: '', station: '', designation: '', phone: '', email: '', status: 'active' });
    setIsEditMode(false);
    setIsFormOpen(true);
  };

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Header Panel */}
      <div className="flex items-center justify-between p-6 bg-[var(--bg-surface)]/80 border border-border-color rounded-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#1E6FD9]/10 rounded-full blur-[80px]" />
        
        <div className="z-10">
          <h1 className="text-2xl font-mono font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-3">
            <ShieldCheck className="w-7 h-7 text-[#1E6FD9]" />
            Officer Management
          </h1>
          <p className="text-[var(--text-secondary)] text-sm mt-2 font-mono">Manage personnel, assignments, and structural hierarchy.</p>
        </div>
        
        <div className="z-10 flex gap-4">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search by name or badge..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 bg-secondary-bg border border-border-color rounded-btn px-4 py-2 pl-10 text-sm font-mono text-[var(--text-primary)] focus:border-[#1E6FD9] outline-none"
            />
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-2.5" />
          </div>
          {isAdmin && (
            <button 
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-[#1E6FD9] hover:bg-[#155BB5] border border-transparent rounded-btn text-sm font-mono text-[var(--text-primary)] font-bold transition-all shadow-glow-blue"
            >
              <Plus className="w-4 h-4" /> Add Officer
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 bg-[#C94A2A]/10 border border-[#C94A2A]/30 rounded text-[#ffb199] text-xs font-mono">
          {error}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {officers.map((officer) => (
              <div key={officer.id} className="bg-secondary-bg border border-border-color rounded-lg p-5 flex flex-col gap-4 hover:border-[#1E6FD9]/50 transition-colors group">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <PersonAvatar
                      imageUrl={officer.image_url}
                      name={officer.name}
                      size={40}
                      accentColor="#1E6FD9"
                      shape="circle"
                    />
                    <div>
                      <h3 className="text-[var(--text-primary)] font-bold text-sm">{officer.name}</h3>
                      <p className="text-[#0E9E78] font-mono text-[10px] uppercase font-bold tracking-wider">{officer.badge_number}</p>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(officer)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(officer.id)} className="text-[#C94A2A] hover:text-[#ff5e36]"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
                
                <div className="space-y-2 text-xs font-mono text-[var(--text-secondary)]">
                  <div className="flex justify-between"><span>Rank</span><span className="text-[var(--text-primary)]">{officer.rank || 'N/A'}</span></div>
                  <div className="flex justify-between"><span>Station</span><span className="text-[var(--text-primary)]">{officer.station}</span></div>
                  <div className="flex justify-between"><span>District</span><span className="text-[var(--text-primary)]">{officer.district || 'N/A'}</span></div>
                </div>
                
                <div className="mt-auto pt-4 border-t border-border-color flex justify-between">
                  <div className="flex gap-3">
                    {officer.email && <a href={`mailto:${officer.email}`} className="text-[var(--text-muted)] hover:text-[#1E6FD9] transition-colors" title={officer.email}><Mail className="w-4 h-4" /></a>}
                    {officer.phone && <a href={`tel:${officer.phone}`} className="text-[var(--text-muted)] hover:text-[#1E6FD9] transition-colors" title={officer.phone}><Phone className="w-4 h-4" /></a>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${officer.status === 'active' ? 'bg-[#0E9E78]/20 text-[#0E9E78]' : 'bg-[#6A7A96]/20 text-[var(--text-muted)]'}`}>
                      {officer.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-[var(--bg-surface)]/80 flex items-center justify-center p-4">
          <div className="bg-secondary-bg border border-[#1E6FD9]/40 rounded-lg shadow-glow-blue max-w-lg w-full p-6 animate-[fadeIn_0.2s_ease-out]">
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4 uppercase font-mono">{isEditMode ? 'Edit Officer' : 'New Officer Profile'}</h2>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Full Name</label>
                <input type="text" value={currentOfficer.name} onChange={e => setCurrentOfficer({...currentOfficer, name: e.target.value})} className="bg-[var(--bg-surface)] border border-border-color rounded px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[#1E6FD9] outline-none" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Badge Number</label>
                <input type="text" value={currentOfficer.badge_number} onChange={e => setCurrentOfficer({...currentOfficer, badge_number: e.target.value})} className="bg-[var(--bg-surface)] border border-border-color rounded px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[#1E6FD9] outline-none" disabled={isEditMode} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Rank</label>
                <input type="text" value={currentOfficer.rank} onChange={e => setCurrentOfficer({...currentOfficer, rank: e.target.value})} className="bg-[var(--bg-surface)] border border-border-color rounded px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[#1E6FD9] outline-none" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Designation</label>
                <input type="text" value={currentOfficer.designation} onChange={e => setCurrentOfficer({...currentOfficer, designation: e.target.value})} className="bg-[var(--bg-surface)] border border-border-color rounded px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[#1E6FD9] outline-none" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Station</label>
                <input type="text" value={currentOfficer.station} onChange={e => setCurrentOfficer({...currentOfficer, station: e.target.value})} className="bg-[var(--bg-surface)] border border-border-color rounded px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[#1E6FD9] outline-none" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono text-[var(--text-muted)] uppercase">District</label>
                <input type="text" value={currentOfficer.district} onChange={e => setCurrentOfficer({...currentOfficer, district: e.target.value})} className="bg-[var(--bg-surface)] border border-border-color rounded px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[#1E6FD9] outline-none" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Phone</label>
                <input type="text" value={currentOfficer.phone} onChange={e => setCurrentOfficer({...currentOfficer, phone: e.target.value})} className="bg-[var(--bg-surface)] border border-border-color rounded px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[#1E6FD9] outline-none" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Email</label>
                <input type="email" value={currentOfficer.email} onChange={e => setCurrentOfficer({...currentOfficer, email: e.target.value})} className="bg-[var(--bg-surface)] border border-border-color rounded px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[#1E6FD9] outline-none" />
              </div>
              <div className="flex flex-col gap-1.5 col-span-2">
                <label className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Status</label>
                <select value={currentOfficer.status} onChange={e => setCurrentOfficer({...currentOfficer, status: e.target.value})} className="bg-[var(--bg-surface)] border border-border-color rounded px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[#1E6FD9] outline-none">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>
            
            <div className="flex justify-end gap-3">
              <button onClick={() => setIsFormOpen(false)} className="px-4 py-2 border border-border-color rounded text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/10 transition-colors font-mono">Cancel</button>
              <button onClick={handleSave} className="px-4 py-2 bg-[#1E6FD9] hover:bg-[#155BB5] rounded text-sm text-[var(--text-primary)] font-bold transition-colors font-mono">Save Profile</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OfficersPage;
