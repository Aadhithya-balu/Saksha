import React, { useMemo, useState, useEffect } from 'react';
import { useNetwork } from '../../hooks/useNetwork';
import GraphExplorerToolbar from '../../components/network/GraphExplorerToolbar';
import NetworkFilterPanel from '../../components/network/NetworkFilterPanel';
import CriminalGraph3D, { type GraphNode, type GraphLink } from '../../components/network/CriminalGraph3D';
import NodeDetailPanel from '../../components/network/NodeDetailPanel';
import EdgeDetailPanel from '../../components/network/EdgeDetailPanel';
import PathFinderPanel from '../../components/network/PathFinderPanel';
import ShortestPathPanel from '../../components/network/ShortestPathPanel';
import GangNetworkView from '../../components/network/GangNetworkView';
import LinkAnalysisPanel from '../../components/network/LinkAnalysisPanel';
import NetworkTimelineSlider from '../../components/network/NetworkTimelineSlider';
import AIGraphInsightsModal from '../../components/network/AIGraphInsightsModal';
import { downloadSecureDossier } from '../../utils/downloader';
import { useAuditStore } from '../../store/auditStore';
import { useAuthStore } from '../../store/authStore';
import { Network as NetIcon, Layers, Database, SearchX, AlertTriangle, Focus, X } from 'lucide-react';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { hasActiveNetworkFilters, buildNetworkPathHighlight, computeFocusSubgraph } from '../../utils/networkSearch';

interface NetworkGraphAreaProps {
  graphData: { nodes: GraphNode[]; links: GraphLink[] } | null;
  loading: boolean;
  error: string | null;
  onNodeSelect: (node: GraphNode) => void;
  onLinkSelect?: (link: GraphLink) => void;
  onClearFilters: () => void;
  highlightPath?: { nodeIds: string[]; linkKeys: string[] } | null;
}

const NetworkGraphArea: React.FC<NetworkGraphAreaProps> = ({
  graphData,
  loading,
  error,
  onNodeSelect,
  onLinkSelect,
  onClearFilters,
  highlightPath,
}) => {
  if (loading) {
    return (
      <div className="w-full p-6">
        <CardSkeleton />
      </div>
    );
  }
  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-center p-6 bg-[var(--bg-surface)] rounded-card border border-[var(--accent-coral)]/30">
        <AlertTriangle className="w-8 h-8 text-[var(--accent-coral)]" />
        <span className="text-xs text-[var(--text-muted)] uppercase max-w-sm">{error}</span>
      </div>
    );
  }
  if (graphData && graphData.nodes.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-center p-6 bg-[var(--bg-surface)] rounded-card border border-[var(--border-secondary)]">
        <SearchX className="w-8 h-8 text-[var(--text-disabled)]" />
        <span className="text-xs text-[var(--text-muted)] uppercase">
          No network relationships found for the selected filters.
        </span>
        <button
          type="button"
          onClick={onClearFilters}
          className="px-3 py-1.5 bg-[var(--bg-tertiary)] hover:bg-[var(--accent-blue)]/20 border border-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-btn text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
        >
          Clear Filters
        </button>
      </div>
    );
  }
  if (!graphData) {
    return (
      <div className="h-full flex items-center justify-center bg-[var(--bg-surface)] rounded-card border border-[var(--border-secondary)]">
        <span className="text-xs text-[var(--text-muted)] uppercase">Graph data unavailable</span>
      </div>
    );
  }
  return (
    <CriminalGraph3D
      onNodeSelect={onNodeSelect}
      onLinkSelect={onLinkSelect}
      graphData={graphData}
      highlightPath={highlightPath}
    />
  );
};

interface WorkspaceSidePanelProps {
  selectedNode: GraphNode | null;
  selectedLink: GraphLink | null;
  nodes: GraphNode[];
  links: GraphLink[];
  emptyMessage: string;
  onCloseNode: () => void;
  onCloseLink: () => void;
  onSelectNode: (node: GraphNode) => void;
  onSelectLink: (link: GraphLink) => void;
  onSetPathSource?: (node: GraphNode) => void;
  onSetPathTarget?: (node: GraphNode) => void;
  onFocusNode?: (node: GraphNode, hops: number) => void;
  onClearFocus?: () => void;
  isFocused: boolean;
  focusHops: number;
}

const WorkspaceSidePanel: React.FC<WorkspaceSidePanelProps> = ({
  selectedNode,
  selectedLink,
  nodes,
  links,
  emptyMessage,
  onCloseNode,
  onCloseLink,
  onSelectNode,
  onSelectLink,
  onSetPathSource,
  onSetPathTarget,
  onFocusNode,
  onClearFocus,
  isFocused,
  focusHops,
}) => {
  if (selectedLink) {
    return (
      <EdgeDetailPanel
        link={selectedLink}
        nodes={nodes}
        onClose={onCloseLink}
        onSelectNode={(n) => {
          onSelectNode(n);
        }}
      />
    );
  }
  if (selectedNode) {
    return (
      <NodeDetailPanel
        node={selectedNode}
        links={links}
        nodes={nodes}
        onClose={onCloseNode}
        onSelectNode={onSelectNode}
        onSelectLink={onSelectLink}
        onSetPathSource={onSetPathSource}
        onSetPathTarget={onSetPathTarget}
        onFocusNode={onFocusNode}
        onClearFocus={onClearFocus}
        isFocused={isFocused}
        focusHops={focusHops}
      />
    );
  }
  return (
    <div className="h-full flex flex-col items-center justify-center p-6 text-center text-xs text-[var(--text-muted)] uppercase border border-dashed border-[var(--border-primary)]/40 rounded-card">
      <Layers className="w-10 h-10 mb-3 text-[var(--text-disabled)]" />
      <span>{emptyMessage}</span>
    </div>
  );
};

export const NetworkPageWorkspace: React.FC = () => {
  const {
    activeView,
    setActiveView,
    categoryFilter,
    setCategoryFilter,
    minRisk,
    setMinRisk,
    networkFilters,
    setNetworkFilters,
    graphData,
    isNeo4jBacked,
    seedNodeCount,
    loading,
    error,
    selectedNode,
    setSelectedNode,
    gangs,
    selectedGang,
    setSelectedGang,
    pathResult,
    pathLoading,
    runShortestPath,
    pathSource,
    setPathSource,
    pathTarget,
    setPathTarget,
    pathMaxHops,
    setPathMaxHops,
    connectionPath,
    connectionLoading,
    connectionError,
    runConnectionSearch,
    clearConnectionPath,
    linkAnalysis,
    insights,
    handleNeo4jSync,
    timelineDateRange,
    setTimelineDateRange,
  } = useNetwork();

  const { user } = useAuthStore();
  const { addLog } = useAuditStore();
  const activeFilters = hasActiveNetworkFilters(networkFilters);
  const resultCount = graphData ? graphData.nodes.length : null;
  const hasExplicitDateFilters = Boolean(networkFilters.dateFrom || networkFilters.dateTo);

  // Issue #230: link selection (edge details) + path/Focus panel state.
  const [selectedLink, setSelectedLink] = useState<GraphLink | null>(null);
  const [highlightOn, setHighlightOn] = useState<boolean>(true);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [focusHops, setFocusHops] = useState<number>(2);

  const handleNodeSelect = (node: GraphNode) => {
    setSelectedLink(null);
    setSelectedNode(node);
  };

  const handleLinkSelect = (link: GraphLink) => {
    setSelectedNode(null);
    setSelectedLink(link);
  };

  const handleSetPathSource = (node: GraphNode) => {
    setPathSource(node);
    setActiveView('path_finder');
  };

  const handleSetPathTarget = (node: GraphNode) => {
    setPathTarget(node);
    setActiveView('path_finder');
  };

  const handleFocusNode = (node: GraphNode, hops: number) => {
    setSelectedLink(null);
    setFocusedNodeId(node.id);
    setFocusHops(hops);
  };

  const handleClearFocus = () => setFocusedNodeId(null);

  const handleClearConnectionPath = () => {
    clearConnectionPath();
    setHighlightOn(true);
  };

  // A stale focus (computed against a previous dataset) is dropped on filter change.
  useEffect(() => {
    setFocusedNodeId(null);
  }, [networkFilters, timelineDateRange]);

  // Issue #230: connection-path highlight normalized to undirected edge keys.
  const highlightPath = useMemo(() => {
    if (!highlightOn) return null;
    return buildNetworkPathHighlight(connectionPath);
  }, [highlightOn, connectionPath]);

  // Focus mode: restrict the rendered subgraph to N hops around a chosen entity.
  const displayData = useMemo(() => {
    const base = graphData ?? { nodes: [], links: [] };
    if (!focusedNodeId) return base;
    return computeFocusSubgraph(base, focusedNodeId, focusHops);
  }, [graphData, focusedNodeId, focusHops]);

  const focusedNode =
    (focusedNodeId ? graphData?.nodes.find((n) => n.id === focusedNodeId) ?? null : null);
  const focusIsSelected = !!focusedNodeId && focusedNodeId === selectedNode?.id;

  const handleExportMatrix = () => {
    const nodeId = (ref: string | any): string => {
      if (typeof ref === 'string') return ref;
      if (ref && typeof ref === 'object') return ref.id ?? ref.name ?? '';
      return String(ref ?? '');
    };

    const matrixData = {
      relationType: 'Criminal Link Association Matrix',
      totalNodes: graphData?.nodes.length ?? 0,
      totalEdges: graphData?.links.length ?? 0,
      isNeo4jBacked,
      activeSuspects: graphData?.nodes.filter((node) => node.category === 'suspect').map((node) => node.name) ?? [],
      relationEdges:
        graphData?.links.map((link) => ({
          from: nodeId(link.source),
          to: nodeId(link.target),
          relation: link.relationship,
        })) ?? [],
    };

    downloadSecureDossier(
      'Suspect Connection Matrix',
      matrixData,
      user ? `CONFIDENTIAL - ${user.badgeId}` : 'CONFIDENTIAL - STATE POLICE'
    );

    if (user) {
      addLog(user.name, user.badgeId, 'EXPORT', 'Exported suspect relationship linkage association matrix (JSON)');
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col gap-3 p-1 md:p-3 select-none bg-[var(--bg-primary)] font-mono">
      {/* Title & Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-[var(--border-muted)] pb-2">
        <div>
          <h2 className="text-md font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
            <NetIcon className="w-5 h-5 text-[#6C43CC] animate-pulse" />
            Graph-Based Criminal Intelligence & Relationship Analysis
          </h2>
          <p className="text-[9.5px] text-[var(--text-muted)] mt-0.5">
            NEO4J CYPHER GRAPH DB • THREE.JS FORCE DIRECTED NETWORK • CONNECTION PATH • GANG SYNDICATES • LINK CENTRALITY
          </p>
        </div>
      </div>

      {/* Gap 132.4: transparency banner for demo-seeded content */}
      {seedNodeCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-card border border-[var(--accent-purple)]/25 bg-[var(--accent-purple)]/5 text-[9.5px] font-mono text-[var(--accent-purple)] uppercase tracking-wider">
          <Database className="w-3.5 h-3.5 flex-shrink-0" />
          Dataset scope: contains {seedNodeCount} seeded demo record{seedNodeCount === 1 ? '' : 's'} — flagged nodes originate from the bundled training dataset, not live intelligence
        </div>
      )}

      {/* Global Explorer Navigation & Filter Toolbar */}
      <GraphExplorerToolbar
        activeView={activeView}
        setActiveView={setActiveView}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        minRisk={minRisk}
        setMinRisk={setMinRisk}
        isNeo4jBacked={isNeo4jBacked}
        onExportMatrix={handleExportMatrix}
        onNeo4jSync={handleNeo4jSync}
      />

      {/* Issue #226: structured multi-parameter search & filter controls */}
      <NetworkFilterPanel
        filters={networkFilters}
        onApply={setNetworkFilters}
        onClear={() => setNetworkFilters({})}
        loading={loading}
        resultCount={resultCount}
        hasActiveFilters={activeFilters}
      />

      {/* Focus mode indicator */}
      {focusedNode && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-card border border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/5 text-[9.5px] font-mono uppercase tracking-wider">
          <Focus className="w-3.5 h-3.5 text-[var(--accent-blue)] animate-pulse" />
          <span className="text-[var(--text-secondary)]">
            Focus mode: <b className="text-[var(--accent-blue)]">{focusedNode.name}</b> — {focusHops} hop{focusHops === 1 ? '' : 's'} around this entity
          </span>
          <button
            onClick={handleClearFocus}
            className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--bg-tertiary)] hover:bg-[var(--accent-coral)]/15 text-[var(--text-muted)] border border-[var(--border-color)] cursor-pointer transition-colors"
          >
            <X className="w-2.5 h-2.5" />
            Exit
          </button>
        </div>
      )}

      {/* Workspace Display Area */}
      <div className="flex-1 w-full">
        {activeView === '3d_explorer' && (
          <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-8 h-full min-h-[420px] lg:min-h-[62vh]">
              <NetworkGraphArea
                graphData={displayData}
                loading={loading}
                error={error}
                highlightPath={highlightPath}
                onNodeSelect={handleNodeSelect}
                onLinkSelect={handleLinkSelect}
                onClearFilters={() => setNetworkFilters({})}
              />
            </div>
            <div className="lg:col-span-4 h-full min-h-[420px] lg:min-h-[62vh] bg-secondary-bg/25 border border-border-color rounded-card overflow-hidden">
              <WorkspaceSidePanel
                selectedNode={selectedNode}
                selectedLink={selectedLink}
                nodes={graphData?.nodes || []}
                links={graphData?.links || []}
                emptyMessage="Select suspect or relationship inside the 3D graph to unlock dossiers telemetry"
                onCloseNode={() => setSelectedNode(null)}
                onCloseLink={() => setSelectedLink(null)}
                onSelectNode={handleNodeSelect}
                onSelectLink={handleLinkSelect}
                onSetPathSource={handleSetPathSource}
                onSetPathTarget={handleSetPathTarget}
                onFocusNode={handleFocusNode}
                onClearFocus={handleClearFocus}
                isFocused={focusIsSelected}
                focusHops={focusHops}
              />
            </div>
          </div>
        )}

        {activeView === 'shortest_path' && (
          <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-8 h-full min-h-[420px] lg:min-h-[62vh]">
              <ShortestPathPanel
                nodes={graphData?.nodes || []}
                onCalculatePath={runShortestPath}
                pathResult={pathResult}
                loading={pathLoading}
                onSelectNodeIn3D={setSelectedNode}
              />
            </div>
            <div className="lg:col-span-4 h-full min-h-[420px] lg:min-h-[62vh] bg-secondary-bg/25 border border-border-color rounded-card overflow-hidden">
              <WorkspaceSidePanel
                selectedNode={selectedNode}
                selectedLink={selectedLink}
                nodes={graphData?.nodes || []}
                links={graphData?.links || []}
                emptyMessage="Select any path node to inspect dossier details"
                onCloseNode={() => setSelectedNode(null)}
                onCloseLink={() => setSelectedLink(null)}
                onSelectNode={handleNodeSelect}
                onSelectLink={handleLinkSelect}
                onSetPathSource={handleSetPathSource}
                onSetPathTarget={handleSetPathTarget}
                onFocusNode={handleFocusNode}
                onClearFocus={handleClearFocus}
                isFocused={focusIsSelected}
                focusHops={focusHops}
              />
            </div>
          </div>
        )}

        {activeView === 'path_finder' && (
          <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
            <div className="lg:col-span-4 h-full min-h-[560px] lg:min-h-[70vh]">
              <PathFinderPanel
                nodes={graphData?.nodes || []}
                pathSource={pathSource}
                pathTarget={pathTarget}
                maxHops={pathMaxHops}
                loading={connectionLoading}
                error={connectionError}
                result={connectionPath}
                highlightOn={highlightOn}
                onSetSource={setPathSource}
                onSetTarget={setPathTarget}
                onSetMaxHops={setPathMaxHops}
                onRunSearch={() => void runConnectionSearch()}
                onToggleHighlight={() => setHighlightOn((v) => !v)}
                onClear={handleClearConnectionPath}
                onSelectNode={handleNodeSelect}
              />
            </div>
            <div className="lg:col-span-8 h-full flex flex-col gap-2 min-h-0">
              <div className="flex-1 min-h-[300px] lg:min-h-[54vh]">
                <NetworkGraphArea
                  graphData={displayData}
                  loading={loading}
                  error={error}
                  highlightPath={highlightPath}
                  onNodeSelect={handleNodeSelect}
                  onLinkSelect={handleLinkSelect}
                  onClearFilters={() => setNetworkFilters({})}
                />
              </div>
              <div className="h-[200px] shrink-0 bg-secondary-bg/25 border border-border-color rounded-card overflow-hidden">
                <WorkspaceSidePanel
                  selectedNode={selectedNode}
                  selectedLink={selectedLink}
                  nodes={graphData?.nodes || []}
                  links={graphData?.links || []}
                  emptyMessage="Select a node or connection to inspect supporting evidence"
                  onCloseNode={() => setSelectedNode(null)}
                  onCloseLink={() => setSelectedLink(null)}
                  onSelectNode={handleNodeSelect}
                  onSelectLink={handleLinkSelect}
                  onSetPathSource={handleSetPathSource}
                  onSetPathTarget={handleSetPathTarget}
                  onFocusNode={handleFocusNode}
                  onClearFocus={handleClearFocus}
                  isFocused={focusIsSelected}
                  focusHops={focusHops}
                />
              </div>
            </div>
          </div>
        )}

        {activeView === 'gangs' && (
          <GangNetworkView
            gangs={gangs}
            selectedGang={selectedGang}
            onSelectGang={setSelectedGang}
            onSelectMemberIn3D={setSelectedNode}
          />
        )}

        {activeView === 'link_analysis' && <LinkAnalysisPanel data={linkAnalysis} loading={loading} />}

        {activeView === 'timeline' && (
          <div className="h-full flex flex-col gap-3">
            <NetworkTimelineSlider onDateChange={setTimelineDateRange} />
            {hasExplicitDateFilters && (
              <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                Explicit date range set in the filter panel — the timeline window is ignored while those dates are active.
              </div>
            )}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
              <div className="lg:col-span-8 h-full min-h-[420px] lg:min-h-[58vh]">
                <NetworkGraphArea
                  graphData={displayData}
                  loading={loading}
                  error={error}
                  highlightPath={highlightPath}
                  onNodeSelect={handleNodeSelect}
                  onLinkSelect={handleLinkSelect}
                  onClearFilters={() => setNetworkFilters({})}
                />
              </div>
              <div className="lg:col-span-4 h-full min-h-[420px] lg:min-h-[58vh] bg-secondary-bg/25 border border-border-color rounded-card overflow-hidden">
                <WorkspaceSidePanel
                  selectedNode={selectedNode}
                  selectedLink={selectedLink}
                  nodes={graphData?.nodes || []}
                  links={graphData?.links || []}
                  emptyMessage="Scrub timeline slider to inspect temporal graph changes"
                  onCloseNode={() => setSelectedNode(null)}
                  onCloseLink={() => setSelectedLink(null)}
                  onSelectNode={handleNodeSelect}
                  onSelectLink={handleLinkSelect}
                  onSetPathSource={handleSetPathSource}
                  onSetPathTarget={handleSetPathTarget}
                  onFocusNode={handleFocusNode}
                  onClearFocus={handleClearFocus}
                  isFocused={focusIsSelected}
                  focusHops={focusHops}
                />
              </div>
            </div>
          </div>
        )}

        {activeView === 'ai_insights' && (
          <AIGraphInsightsModal insights={insights} nodes={graphData?.nodes || []} onSelectNodeIn3D={setSelectedNode} />
        )}
      </div>
    </div>
  );
};

export default NetworkPageWorkspace;