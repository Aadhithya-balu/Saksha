import React from 'react';
import type { AIGraphInsightData } from '../../services/api';
import { Sparkles, ShieldAlert, Crosshair, Lightbulb } from 'lucide-react';
import type { GraphNode } from './CriminalGraph3D';

interface AIGraphInsightsModalProps {
  insights: AIGraphInsightData[];
  onSelectNodeIn3D?: (node: GraphNode) => void;
  nodes?: GraphNode[];
}

export const AIGraphInsightsModal: React.FC<AIGraphInsightsModalProps> = ({ insights, onSelectNodeIn3D, nodes }) => {
  return (
    <div className="h-full flex flex-col gap-4 p-4 bg-[var(--bg-surface)] border border-[var(--border-secondary)] rounded-card font-mono overflow-y-auto">
      {/* Header */}
      <div className="border-b border-[var(--border-secondary)] pb-3">
        <h3 className="text-md font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
          AI Graph Intelligence & Threat Assessment
        </h3>
        <p className="text-[10px] text-[var(--text-muted)] mt-1">
          AUTOMATED BROKER DISCOVERY, CROSS-SYNDICATE PATTERN MATCHING, AND ACTIONABLE INVESTIGATION ADVISORIES
        </p>
      </div>

      {/* Insight Cards List */}
      <div className="space-y-4 flex-1">
        {insights.map((insight) => (
          <div
            key={insight.id}
            className="p-4 bg-[var(--bg-primary)] border border-[var(--border-secondary)] rounded-card space-y-3 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert
                  className={`w-4 h-4 ${
                    insight.threat_level === 'CRITICAL'
                      ? 'text-rose-400'
                      : insight.threat_level === 'HIGH'
                      ? 'text-amber-400'
                      : 'text-[#60A5FA]'
                  }`}
                />
                <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase">{insight.title}</h4>
              </div>
              <span
                className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase ${
                  insight.threat_level === 'CRITICAL'
                    ? 'bg-rose-950/60 text-rose-400 border border-rose-500/40'
                    : insight.threat_level === 'HIGH'
                    ? 'bg-amber-950/60 text-amber-400 border border-amber-500/40'
                    : 'bg-blue-950/60 text-[#60A5FA] border border-blue-500/40'
                }`}
              >
                {insight.threat_level} THREAT
              </span>
            </div>

            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{insight.description}</p>

            {/* AI Recommendation Box */}
            <div className="p-3 bg-[var(--bg-tertiary)] rounded border border-[var(--border-primary)] flex items-start gap-2 text-[10.5px]">
              <Lightbulb className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
              <div>
                <strong className="text-amber-300 uppercase">AI Tactical Recommendation: </strong>
                <span className="text-[var(--text-secondary)]">{insight.recommendation}</span>
              </div>
            </div>

            {/* Target Nodes Action buttons */}
            {insight.target_node_ids && insight.target_node_ids.length > 0 && (
              <div className="flex items-center gap-2 text-[10px] pt-1">
                <span className="text-[var(--text-muted)] uppercase">Target Nodes:</span>
                {insight.target_node_ids.map((nid) => {
                  const targetNode = nodes?.find((n) => n.id === nid);
                  return (
                    <button
                      key={nid}
                      onClick={() => {
                        if (targetNode) onSelectNodeIn3D?.(targetNode);
                      }}
                      disabled={!targetNode}
                      title={targetNode ? `Select ${targetNode.name}` : `Node ${nid} not present in the current graph data`}
                      className="px-2 py-0.5 bg-[var(--bg-tertiary)] hover:bg-[var(--accent-blue)]/20 border border-[var(--border-secondary)] text-[#60A5FA] rounded transition-colors cursor-pointer flex items-center gap-1 uppercase font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Crosshair className="w-3 h-3" />
                      <span>{targetNode ? targetNode.name : nid}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AIGraphInsightsModal;
