import { useCallback, useEffect, useState } from 'react';
import { GitBranch, Network, RefreshCw, Search } from 'lucide-react';
import {
  getKGFragment,
  getKGStats,
  rebuildKG,
  searchKGNodes,
  type KGFragment,
  type KGNodeRecord,
  type KGStats,
} from '../services/api';
import { useAuditStore } from '../store/auditStore';
import { useAuthStore } from '../store/authStore';

const NODE_TONES: Record<string, string> = {
  PERSON: 'bg-[#1E6FD9]/10 text-[#1E6FD9]',
  FIR: 'bg-[#D97706]/10 text-[#D97706]',
  CRIME_CASE: 'bg-[#0E9E78]/10 text-[#0E9E78]',
  VICTIM: 'bg-[#8B5CF6]/10 text-[#8B5CF6]',
  LOCATION: 'bg-[#4A5568]/10 text-[#4A5568]',
};

export default function KnowledgeGraph() {
  const { user } = useAuthStore();
  const { addLog } = useAuditStore();
  const [stats, setStats] = useState<KGStats | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<KGNodeRecord[]>([]);
  const [resultTotal, setResultTotal] = useState(0);
  const [fragment, setFragment] = useState<KGFragment | null>(null);
  const [searching, setSearching] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canWrite = user?.role === 'ADMIN' || user?.role === 'SCRB';

  const fetchStats = useCallback(async () => {
    try {
      setStats(await getKGStats());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load knowledge graph');
    }
  }, []);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  const handleSearch = async () => {
    setSearching(true);
    try {
      const res = await searchKGNodes(query.trim() || undefined, 25);
      setResults(res.items);
      setResultTotal(res.total);
      setFragment(null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const openFragment = async (nodeId: string) => {
    setSearching(true);
    try {
      const frag = await getKGFragment(nodeId, 2);
      setFragment(frag);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load fragment');
    } finally {
      setSearching(false);
    }
  };

  const handleRebuild = async () => {
    setRebuilding(true);
    try {
      const res = await rebuildKG();
      addLog(user?.name ?? 'Operator', user?.badgeId ?? '-', 'CREATE', `Rebuilt knowledge graph (${res.nodes} nodes, ${res.edges} edges)`);
      await fetchStats();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rebuild failed');
    } finally {
      setRebuilding(false);
    }
  };

  const statCards = stats
    ? [
        { label: 'Nodes', value: stats.node_total },
        { label: 'Edges', value: stats.edge_total },
        { label: 'Node Types', value: Object.keys(stats.nodes_by_type ?? {}).length },
        { label: 'Directions', value: Object.keys(stats.edges_by_direction ?? {}).length },
      ]
    : [];

  return (
    <div className="flex flex-col gap-5 select-none">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-md font-mono font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
            <Network className="w-5 h-5 text-[#1E6FD9]" /> Cross-Case Intelligence Graph
          </h2>
          <p className="text-[9.5px] font-mono text-[var(--text-muted)] mt-0.5">
            Phase 3 · entity relationships mined from FIRs, cases and victims
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canWrite && (
            <button
              onClick={() => void handleRebuild()}
              disabled={rebuilding}
              className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg text-[10px] font-mono font-bold hover:bg-[#F472B6]/10 hover:text-[#F472B6] transition-colors cursor-pointer disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${rebuilding ? 'animate-spin' : ''}`} /> {rebuilding ? 'Rebuilding…' : 'Rebuild Graph'}
            </button>
          )}
          <button
            onClick={() => void fetchStats()}
            className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg text-[10px] font-mono font-bold hover:bg-[var(--accent-blue-subtle)] transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/20 text-[#EF4444] text-[10px] font-mono">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map((c) => (
          <div key={c.label} className="rounded-xl border border-[var(--border-muted)] bg-[var(--bg-secondary)] p-3">
            <div className="text-[9px] font-mono uppercase tracking-wider text-[var(--text-muted)]">{c.label}</div>
            <div className="text-2xl font-bold font-mono mt-1 text-[var(--text-primary)]">{c.value}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="rounded-xl border border-[var(--border-muted)] bg-[var(--bg-secondary)] p-4">
        <h3 className="text-[11px] font-mono font-bold text-[var(--text-primary)] uppercase tracking-wider mb-3 flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-[#0E9E78]" /> Search Nodes & Explore Fragment
        </h3>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleSearch(); }}
            placeholder="Search persons, FIRs, cases, victims…"
            className="flex-1 bg-[var(--bg-primary)] border border-[var(--border-muted)] rounded-md px-2 py-1.5 text-[11px] font-mono focus:border-[var(--accent-blue)] outline-none"
          />
          <button
            onClick={() => void handleSearch()}
            disabled={searching}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#1E6FD9] text-white rounded-lg text-[10px] font-mono font-bold hover:bg-[#1E6FD9]/90 disabled:opacity-40 transition-colors cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" /> Search
          </button>
        </div>
        {searching && !fragment && (
          <p className="text-[10px] font-mono text-[var(--text-muted)] mt-3">Querying knowledge graph…</p>
        )}
        {!searching && results.length > 0 && (
          <p className="text-[9.5px] font-mono text-[var(--text-muted)] mt-3">{resultTotal} node(s). Pick one to open a 2-hop fragment.</p>
        )}
        {results.length > 0 && (
          <div className="mt-2 space-y-1">
            {results.map((node) => {
              const tone = NODE_TONES[node.node_type] ?? 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]';
              return (
                <button
                  key={node.id}
                  onClick={() => void openFragment(node.id)}
                  className="w-full text-left px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-muted)] hover:border-[var(--accent-blue)] transition-colors cursor-pointer flex items-center justify-between gap-3"
                >
                  <span className="text-[11px] font-mono text-[var(--text-primary)]">{node.label}</span>
                  <span className="flex items-center gap-2">
                    {node.districts?.length > 0 && (
                      <span className="text-[9px] font-mono text-[var(--text-muted)]">{node.districts.join(', ')}</span>
                    )}
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-mono font-bold ${tone}`}>{node.node_type}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Fragment */}
      {fragment && (
        <div className="rounded-xl border border-[var(--border-muted)] bg-[var(--bg-secondary)] p-4 overflow-x-auto">
          <h3 className="text-[11px] font-mono font-bold text-[var(--text-primary)] uppercase tracking-wider mb-3">
            Fragment (depth {fragment.depth}) · {fragment.nodes.length} nodes, {fragment.edges.length} edges
          </h3>
          {fragment.nodes.length === 0 ? (
            <p className="text-[10px] font-mono text-[var(--text-muted)]">No connected nodes.</p>
          ) : (
            <div className="flex flex-col gap-4">
              <table className="w-full text-left text-[10px] font-mono">
                <thead>
                  <tr className="text-[var(--text-muted)] border-b border-[var(--border-muted)]">
                    <th className="py-1.5 pr-3">Node</th>
                    <th className="py-1.5 pr-3">Type</th>
                    <th className="py-1.5 pr-3">District</th>
                    <th className="py-1.5 pr-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {fragment.nodes.map((node) => {
                    const tone = NODE_TONES[node.node_type] ?? 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]';
                    return (
                      <tr key={node.id} className="border-b border-[var(--border-muted)]/40">
                        <td className="py-1.5 pr-3 text-[var(--text-primary)]">{node.label}</td>
                        <td className="py-1.5 pr-3"><span className={`px-2 py-0.5 rounded-md font-bold ${tone}`}>{node.node_type}</span></td>
                        <td className="py-1.5 pr-3 text-[var(--text-muted)]">{node.districts?.join(', ') || '—'}</td>
                        <td className="py-1.5 pr-3 text-[var(--text-muted)]">{node.status}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <table className="w-full text-left text-[10px] font-mono">
                <thead>
                  <tr className="text-[var(--text-muted)] border-b border-[var(--border-muted)]">
                    <th className="py-1.5 pr-3">Relationship</th>
                    <th className="py-1.5 pr-3">Direction</th>
                    <th className="py-1.5 pr-3">Strength</th>
                    <th className="py-1.5 pr-3">Basis</th>
                  </tr>
                </thead>
                <tbody>
                  {fragment.edges.map((edge) => (
                    <tr key={edge.id} className="border-b border-[var(--border-muted)]/40">
                      <td className="py-1.5 pr-3 text-[var(--text-primary)]">{edge.relationship_type}</td>
                      <td className="py-1.5 pr-3 text-[var(--text-muted)]">{edge.direction}</td>
                      <td className="py-1.5 pr-3">{(edge.strength * 100).toFixed(0)}%</td>
                      <td className="py-1.5 pr-3 text-[var(--text-muted)]">{edge.basis ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}