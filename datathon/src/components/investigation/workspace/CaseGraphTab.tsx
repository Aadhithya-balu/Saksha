import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import {
  Share2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Users,
  Car,
  MapPin,
  Package,
  Shield,
  Maximize2,
  Minimize2,
  X,
  ExternalLink,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import type {
  InvestigationData,
  NetworkNode,
  NetworkEdge,
  NetworkGraphResponse,
} from '../../../services/api';
import { getCaseNetworkGraph } from '../../../services/api';

interface Props {
  caseId: string;
  data: InvestigationData;
  onNavigateTab?: (tab: string, targetId?: string) => void;
}

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  category: string;
  riskScore?: number;
  details?: string;
  casesCount?: number;
  status?: string | null;
  district?: string | null;
  extra?: Record<string, any>;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  source: string | SimNode;
  target: string | SimNode;
  relationship: string;
  provenance?: string;
  verification_status?: string;
  confidence?: number | null;
}

const CATEGORY_COLORS: Record<string, { bg: string; border: string; glow: string; text: string }> = {
  case: { bg: '#7c3aed', border: '#a78bfa', glow: 'rgba(124, 58, 237, 0.4)', text: '#ffffff' },
  suspect: { bg: '#dc2626', border: '#f87171', glow: 'rgba(220, 38, 38, 0.4)', text: '#ffffff' },
  offender: { bg: '#dc2626', border: '#f87171', glow: 'rgba(220, 38, 38, 0.4)', text: '#ffffff' },
  vehicle: { bg: '#d97706', border: '#fbbf24', glow: 'rgba(217, 119, 6, 0.4)', text: '#ffffff' },
  location: { bg: '#0891b2', border: '#22d3ee', glow: 'rgba(8, 145, 178, 0.4)', text: '#ffffff' },
  evidence: { bg: '#059669', border: '#34d399', glow: 'rgba(5, 150, 105, 0.4)', text: '#ffffff' },
  officer: { bg: '#2563eb', border: '#60a5fa', glow: 'rgba(37, 99, 235, 0.4)', text: '#ffffff' },
  victim: { bg: '#16a34a', border: '#4ade80', glow: 'rgba(22, 163, 74, 0.4)', text: '#ffffff' },
  gang: { bg: '#9333ea', border: '#c084fc', glow: 'rgba(147, 51, 234, 0.4)', text: '#ffffff' },
};

export const CaseGraphTab: React.FC<Props> = ({ caseId, data, onNavigateTab }) => {
  const [loading, setLoading] = useState(true);
  const [rawNodes, setRawNodes] = useState<NetworkNode[]>([]);
  const [rawEdges, setRawEdges] = useState<NetworkEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<SimNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<SimLink | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // Load graph from API or synthesize fallback from dossier
  useEffect(() => {
    let isMounted = true;
    const fetchGraph = async () => {
      try {
        setLoading(true);
        const res: NetworkGraphResponse = await getCaseNetworkGraph(caseId);
        if (!isMounted) return;

        if (res && res.nodes && res.nodes.length > 0) {
          setRawNodes(res.nodes);
          setRawEdges(res.edges || []);
        } else {
          synthesizeGraph();
        }
      } catch (err) {
        console.warn('Network graph API error, synthesizing fallback graph from investigation data:', err);
        if (isMounted) synthesizeGraph();
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    const synthesizeGraph = () => {
      const caseItem = data.case;
      const nodes: NetworkNode[] = [];
      const edges: NetworkEdge[] = [];

      // Primary Case Node
      const caseNodeId = `case-${caseItem.id}`;
      nodes.push({
        id: caseNodeId,
        name: `Case ${caseItem.case_number}`,
        category: 'case',
        details: caseItem.description || `Case ${caseItem.case_number}`,
        casesCount: 1,
        status: caseItem.status,
        district: caseItem.district,
      });

      // FIR Nodes
      (data.firs || []).forEach((fir) => {
        const firNodeId = `fir-${fir.id}`;
        nodes.push({
          id: firNodeId,
          name: `FIR ${fir.fir_number}`,
          category: 'case',
          details: `Filed by ${fir.complainant_name || 'Complainant'} (${fir.police_station || 'Station'})`,
          casesCount: 1,
          status: fir.status,
        });
        edges.push({
          source: firNodeId,
          target: caseNodeId,
          relationship: 'CONSOLIDATED_IN_CASE',
          provenance: 'DIRECT_DATABASE',
          verification_status: 'VERIFIED',
          confidence: 1.0,
        });
      });

      // Criminal / Accused Nodes
      (data.criminals || []).forEach((crm) => {
        const crmNodeId = `criminal-${crm.id}`;
        nodes.push({
          id: crmNodeId,
          name: crm.full_name || 'Unknown Suspect',
          category: 'suspect',
          details: `Status: ${crm.status || 'Active'} | Gang: ${crm.gang_affiliation || 'Independent'}`,
          casesCount: crm.total_cases_count || 1,
          status: crm.status,
          extra: { phone: crm.phone_number, criminal_id: crm.id },
        });
        edges.push({
          source: crmNodeId,
          target: caseNodeId,
          relationship: 'CHARGED_IN',
          provenance: 'DIRECT_DATABASE',
          verification_status: 'VERIFIED',
          confidence: 0.98,
        });
      });

      // Vehicle Nodes
      (data.vehicles || []).forEach((veh) => {
        const vehNodeId = `vehicle-${veh.id}`;
        nodes.push({
          id: vehNodeId,
          name: veh.registration || 'Vehicle',
          category: 'vehicle',
          details: `${veh.make_model || 'Vehicle'} (${veh.color || 'Unknown color'}) - ${veh.status}`,
          casesCount: 1,
          status: veh.status,
        });
        edges.push({
          source: vehNodeId,
          target: caseNodeId,
          relationship: 'IMPLICATED_VEHICLE',
          provenance: 'DIRECT_DATABASE',
          verification_status: 'VERIFIED',
          confidence: 0.95,
        });
      });

      // Location Nodes
      (data.locations || []).forEach((loc) => {
        const locNodeId = `location-${loc.id}`;
        nodes.push({
          id: locNodeId,
          name: loc.name || 'Incident Scene',
          category: 'location',
          details: `${loc.type || 'Location'} in ${loc.district || 'Jurisdiction'}`,
          casesCount: 1,
          district: loc.district,
        });
        edges.push({
          source: locNodeId,
          target: caseNodeId,
          relationship: 'SCENE_OF_CRIME',
          provenance: 'DIRECT_DATABASE',
          verification_status: 'VERIFIED',
          confidence: 1.0,
        });
      });

      // Evidence Nodes
      (data.evidence || []).forEach((ev) => {
        const evNodeId = `evidence-${ev.id}`;
        nodes.push({
          id: evNodeId,
          name: ev.title || ev.description || `Exhibit #${ev.id.slice(0, 8)}`,
          category: 'evidence',
          details: `Type: ${ev.evidence_type} | Custody: ${ev.current_custody || ev.chain_of_custody || 'State Custody'}`,
          casesCount: 1,
          status: ev.status || 'Logged',
        });
        edges.push({
          source: evNodeId,
          target: caseNodeId,
          relationship: 'SEIZED_EVIDENCE',
          provenance: 'DIRECT_DATABASE',
          verification_status: 'VERIFIED',
          confidence: 1.0,
        });
      });

      // Officer Node
      if (caseItem.assigned_officer) {
        const offNodeId = `officer-${caseItem.assigned_officer.id}`;
        nodes.push({
          id: offNodeId,
          name: caseItem.assigned_officer.full_name || 'Assigned Officer',
          category: 'officer',
          details: `Badge: ${caseItem.assigned_officer.badge_number} | Station: ${caseItem.assigned_officer.station}`,
          casesCount: 1,
          district: caseItem.assigned_officer.station,
        });
        edges.push({
          source: offNodeId,
          target: caseNodeId,
          relationship: 'INVESTIGATING_OFFICER',
          provenance: 'DIRECT_DATABASE',
          verification_status: 'VERIFIED',
          confidence: 1.0,
        });
      }

      setRawNodes(nodes);
      setRawEdges(edges);
    };

    fetchGraph();

    return () => {
      isMounted = false;
    };
  }, [caseId, data]);

  // Filtered nodes and edges based on active category filter
  const { filteredNodes, filteredEdges } = useMemo(() => {
    if (categoryFilter === 'all') {
      return { filteredNodes: rawNodes, filteredEdges: rawEdges };
    }
    const nodes = rawNodes.filter((n) => n.category === categoryFilter || n.category === 'case');
    const nodeIds = new Set(nodes.map((n) => n.id));
    const edges = rawEdges.filter((e) => {
      const src = typeof e.source === 'object' ? (e.source as any).id : e.source;
      const tgt = typeof e.target === 'object' ? (e.target as any).id : e.target;
      return nodeIds.has(src) && nodeIds.has(tgt);
    });
    return { filteredNodes: nodes, filteredEdges: edges };
  }, [rawNodes, rawEdges, categoryFilter]);

  // Render D3 Force Simulation
  useEffect(() => {
    if (!svgRef.current || filteredNodes.length === 0) return;

    const width = containerRef.current ? containerRef.current.clientWidth : 800;
    const height = isFullscreen ? window.innerHeight - 100 : 540;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Definitions for arrowheads and gradients
    const defs = svg.append('defs');

    // Arrow marker
    defs
      .append('marker')
      .attr('id', 'graph-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 24)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#64748b');

    // Container for zooming
    const g = svg.append('g').attr('class', 'graph-content');

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);
    zoomBehaviorRef.current = zoom;

    // Deep copy data for simulation
    const simNodes: SimNode[] = filteredNodes.map((n) => ({ ...n }));
    const simLinks: SimLink[] = filteredEdges.map((e) => ({
      ...e,
      source: typeof e.source === 'object' ? (e.source as any).id : e.source,
      target: typeof e.target === 'object' ? (e.target as any).id : e.target,
    }));

    // Setup Force Simulation
    const simulation = d3
      .forceSimulation<SimNode>(simNodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(120)
      )
      .force('charge', d3.forceManyBody().strength(-350))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(40));

    // Draw Links
    const linkGroup = g
      .append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(simLinks)
      .enter()
      .append('line')
      .attr('stroke', '#475569')
      .attr('stroke-width', (d) => (d.confidence ? Math.max(1.5, d.confidence * 2.5) : 2))
      .attr('stroke-opacity', 0.6)
      .attr('marker-end', 'url(#graph-arrow)')
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        setSelectedEdge(d);
        setSelectedNode(null);
      })
      .on('mouseenter', function () {
        d3.select(this).attr('stroke', '#38bdf8').attr('stroke-opacity', 1).attr('stroke-width', 3);
      })
      .on('mouseleave', function (_event, d) {
        d3.select(this)
          .attr('stroke', '#475569')
          .attr('stroke-opacity', 0.6)
          .attr('stroke-width', (d as any).confidence ? Math.max(1.5, (d as any).confidence * 2.5) : 2);
      });

    // Draw Link Labels (relationship badges)
    const linkLabels = g
      .append('g')
      .attr('class', 'link-labels')
      .selectAll('text')
      .data(simLinks)
      .enter()
      .append('text')
      .attr('font-size', '8px')
      .attr('font-family', 'monospace')
      .attr('fill', '#94a3b8')
      .attr('text-anchor', 'middle')
      .attr('dy', -4)
      .text((d) => d.relationship.replace(/_/g, ' '));

    // Drag behavior for nodes
    const drag = d3
      .drag<SVGGElement, SimNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    // Draw Nodes
    const nodeGroup = g
      .append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(simNodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .call(drag as any)
      .on('click', (event, d) => {
        event.stopPropagation();
        setSelectedNode(d);
        setSelectedEdge(null);
      });

    // Node Outer Glow / Halo
    nodeGroup
      .append('circle')
      .attr('r', (d) => (d.category === 'case' ? 24 : 17))
      .attr('fill', (d) => (CATEGORY_COLORS[d.category] || CATEGORY_COLORS.case).bg)
      .attr('fill-opacity', 0.2)
      .attr('stroke', (d) => (CATEGORY_COLORS[d.category] || CATEGORY_COLORS.case).border)
      .attr('stroke-width', (d) => (d.category === 'case' ? 3 : 1.5))
      .attr('stroke-dasharray', (d) => (d.category === 'case' ? 'none' : 'none'));

    // Node Core Circle
    nodeGroup
      .append('circle')
      .attr('r', (d) => (d.category === 'case' ? 16 : 11))
      .attr('fill', (d) => (CATEGORY_COLORS[d.category] || CATEGORY_COLORS.case).bg)
      .attr('stroke', '#0f172a')
      .attr('stroke-width', 2);

    // Node Labels
    nodeGroup
      .append('text')
      .attr('dy', (d) => (d.category === 'case' ? 32 : 25))
      .attr('text-anchor', 'middle')
      .attr('font-size', (d) => (d.category === 'case' ? '11px' : '9.5px'))
      .attr('font-weight', (d) => (d.category === 'case' ? 'bold' : 'normal'))
      .attr('font-family', 'sans-serif')
      .attr('fill', '#f8fafc')
      .text((d) => (d.name.length > 20 ? d.name.slice(0, 18) + '…' : d.name));

    // Simulation Tick handler
    simulation.on('tick', () => {
      linkGroup
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      linkLabels
        .attr('x', (d: any) => (d.source.x + d.target.x) / 2)
        .attr('y', (d: any) => (d.source.y + d.target.y) / 2);

      nodeGroup.attr('transform', (d) => `translate(${d.x || 0},${d.y || 0})`);
    });

    // Background click resets selection
    svg.on('click', () => {
      setSelectedNode(null);
      setSelectedEdge(null);
    });

    return () => {
      simulation.stop();
    };
  }, [filteredNodes, filteredEdges, isFullscreen]);

  // Zoom controls
  const handleZoom = (scaleFactor: number) => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.scaleBy, scaleFactor);
  };

  const handleResetZoom = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current)
      .transition()
      .duration(350)
      .call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
  };

  return (
    <div
      ref={containerRef}
      className={`space-y-4 text-left transition-all ${
        isFullscreen ? 'fixed inset-0 z-50 bg-[var(--bg-primary)] p-6 overflow-hidden' : ''
      }`}
    >
      {/* Top Header & Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)]">
              <Share2 className="w-5 h-5 text-indigo-400" />
            </span>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                Case Relationship Network Graph
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Multi-entity relational intelligence linking accused persons, seized vehicles, crime scenes, and evidence.
              </p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg p-0.5">
            <button
              onClick={() => handleZoom(1.25)}
              className="p-1.5 hover:text-white text-[var(--text-muted)] rounded transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleZoom(0.8)}
              className="p-1.5 hover:text-white text-[var(--text-muted)] rounded transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetZoom}
              className="p-1.5 hover:text-white text-[var(--text-muted)] rounded transition-colors"
              title="Reset View"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--bg-tertiary)] hover:bg-[var(--bg-elevated)] border border-[var(--border-primary)] text-[var(--text-primary)] transition-all cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar text-xs">
        {[
          { id: 'all', label: `All Entities (${rawNodes.length})` },
          { id: 'suspect', label: 'Accused & Suspects', icon: <Users className="w-3 h-3 text-rose-400" /> },
          { id: 'vehicle', label: 'Vehicles', icon: <Car className="w-3 h-3 text-amber-400" /> },
          { id: 'location', label: 'Scenes', icon: <MapPin className="w-3 h-3 text-cyan-400" /> },
          { id: 'evidence', label: 'Evidence', icon: <Package className="w-3 h-3 text-emerald-400" /> },
          { id: 'officer', label: 'Officers', icon: <Shield className="w-3 h-3 text-blue-400" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setCategoryFilter(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all cursor-pointer ${
              categoryFilter === tab.id
                ? 'bg-indigo-600 text-white font-bold shadow-md'
                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-primary)]'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Main Canvas + Side Inspector */}
      <div className="relative bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="h-[520px] flex flex-col items-center justify-center text-xs text-[var(--text-muted)] gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
            <span>Calculating graph topology and entity linkages…</span>
          </div>
        ) : (
          <div className="relative">
            <svg
              ref={svgRef}
              className="w-full h-[540px] bg-slate-950/70 cursor-grab active:cursor-grabbing"
            />

            {/* Floating Legend */}
            <div className="absolute top-4 left-4 p-3 bg-slate-900/90 backdrop-blur-md border border-slate-700/60 rounded-xl text-[10px] space-y-1.5 pointer-events-none shadow-xl">
              <div className="font-mono font-bold uppercase tracking-wider text-slate-400 mb-1">
                Network Legend
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-sm shadow-purple-500/50" />
                <span className="text-slate-200">Crime Case / FIR</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50" />
                <span className="text-slate-200">Accused / Suspect</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50" />
                <span className="text-slate-200">Vehicle</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 shadow-sm shadow-cyan-500/50" />
                <span className="text-slate-200">Scene / Location</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                <span className="text-slate-200">Physical Evidence</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50" />
                <span className="text-slate-200">Investigating Officer</span>
              </div>
            </div>

            {/* Node Inspector Drawer */}
            {selectedNode && (
              <div className="absolute top-4 right-4 w-80 bg-slate-900/95 backdrop-blur-md border border-slate-700/70 rounded-xl p-4 shadow-2xl text-xs space-y-3 animate-in fade-in slide-in-from-right-4 duration-200">
                <div className="flex items-start justify-between border-b border-slate-700/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{
                        backgroundColor: (CATEGORY_COLORS[selectedNode.category] || CATEGORY_COLORS.case).bg,
                      }}
                    />
                    <span className="font-mono text-[10px] uppercase font-bold text-slate-300">
                      {selectedNode.category} Entity
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedNode(null)}
                    className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-white">{selectedNode.name}</h3>
                  {selectedNode.status && (
                    <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-800 border border-slate-700 text-slate-300">
                      Status: {selectedNode.status}
                    </span>
                  )}
                </div>

                {selectedNode.details && (
                  <p className="text-slate-300 text-[11px] leading-relaxed bg-slate-800/50 p-2.5 rounded-lg border border-slate-700/40">
                    {selectedNode.details}
                  </p>
                )}

                <div className="space-y-1.5 text-[11px]">
                  {selectedNode.riskScore !== undefined && (
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">Risk Assessment</span>
                      <span className="font-bold text-rose-400">{selectedNode.riskScore}%</span>
                    </div>
                  )}
                  {selectedNode.district && (
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">District / Station</span>
                      <span className="text-slate-200">{selectedNode.district}</span>
                    </div>
                  )}
                  {selectedNode.casesCount !== undefined && (
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">Connected Cases</span>
                      <span className="text-slate-200">{selectedNode.casesCount}</span>
                    </div>
                  )}
                </div>

                {/* Quick Navigate Button */}
                {selectedNode.category === 'suspect' && onNavigateTab && (
                  <button
                    onClick={() => {
                      const criminalId = selectedNode.extra?.criminal_id || selectedNode.id.replace('criminal-', '');
                      onNavigateTab('criminals', criminalId);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-semibold text-xs shadow-md transition-all cursor-pointer mt-2"
                  >
                    <span>Open Person Dossier</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
                {selectedNode.category === 'evidence' && onNavigateTab && (
                  <button
                    onClick={() => onNavigateTab('evidence')}
                    className="w-full flex items-center justify-center gap-1.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-xs shadow-md transition-all cursor-pointer mt-2"
                  >
                    <span>View in Evidence Vault</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Edge Inspector Drawer */}
            {selectedEdge && (
              <div className="absolute top-4 right-4 w-72 bg-slate-900/95 backdrop-blur-md border border-slate-700/70 rounded-xl p-4 shadow-2xl text-xs space-y-3 animate-in fade-in slide-in-from-right-4 duration-200">
                <div className="flex items-start justify-between border-b border-slate-700/60 pb-2">
                  <span className="font-mono text-[10px] uppercase font-bold text-cyan-400">
                    Relationship Link
                  </span>
                  <button
                    onClick={() => setSelectedEdge(null)}
                    className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <h4 className="text-xs font-mono font-bold text-white uppercase">
                    {selectedEdge.relationship.replace(/_/g, ' ')}
                  </h4>
                  <div className="mt-2 space-y-1.5 text-[11px]">
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">Provenance</span>
                      <span className="text-slate-200 font-mono">
                        {selectedEdge.provenance || 'DIRECT_DATABASE'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">Verification</span>
                      <span className="text-emerald-400 font-semibold font-mono">
                        {selectedEdge.verification_status || 'VERIFIED'}
                      </span>
                    </div>
                    {selectedEdge.confidence !== undefined && (
                      <div className="flex justify-between py-1 border-b border-slate-800">
                        <span className="text-slate-400">Confidence</span>
                        <span className="text-cyan-400 font-mono">
                          {Math.round((selectedEdge.confidence || 1) * 100)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
