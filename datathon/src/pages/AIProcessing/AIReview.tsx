import React, { useEffect, useState } from 'react';
import { getPendingAIMatches, verifyAIMatch, AIMatchRecord } from '../../services/api';

export default function AIReview() {
  const [matches, setMatches] = useState<AIMatchRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    try {
      const data = await getPendingAIMatches();
      setMatches(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (id: string, decision: 'CONFIRM' | 'REJECT') => {
    await verifyAIMatch(id, decision);
    setMatches(matches.filter(m => m.id !== id));
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">AI Entity Resolution Review</h1>
      
      {loading ? (
        <p>Loading matches...</p>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {matches.map((match) => (
            <div key={match.id} className="bg-white rounded-lg shadow p-6 border-l-4 border-indigo-500">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Potential Match Found</h3>
              <p className="text-sm text-gray-500 mb-4">
                AI extracted an entity that might match an existing record with {(match.match_score * 100).toFixed(1)}% confidence.
              </p>
              
              <div className="flex flex-col md:flex-row gap-4 mb-4">
                <div className="flex-1 bg-gray-50 p-4 rounded-md">
                  <h4 className="font-semibold mb-2">New Extracted Entity</h4>
                  <div className="text-sm">
                    <p>Type: <span className="font-mono font-medium">{match.candidate_ai_entity?.entity_type}</span></p>
                    <pre className="mt-2 text-xs text-gray-600 bg-gray-200 p-2 rounded">{JSON.stringify(match.candidate_ai_entity?.attributes, null, 2)}</pre>
                  </div>
                </div>
                <div className="flex-1 bg-gray-50 p-4 rounded-md border border-indigo-100">
                  <h4 className="font-semibold mb-2">Existing {match.source_entity_type}</h4>
                  <div className="text-sm">
                    <p>ID: <span className="font-mono font-medium">{match.source_entity_id.substring(0,8)}...</span></p>
                    <pre className="mt-2 text-xs text-gray-600 bg-gray-200 p-2 rounded">{JSON.stringify(match.matching_attributes, null, 2)}</pre>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end mt-4 pt-4 border-t border-gray-100">
                <button onClick={() => handleDecision(match.id, 'REJECT')} className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50 font-medium transition-colors">
                  Reject
                </button>
                <button onClick={() => handleDecision(match.id, 'CONFIRM')} className="px-4 py-2 bg-indigo-600 rounded text-sm text-white hover:bg-indigo-700 font-medium transition-colors shadow-sm">
                  Confirm Match
                </button>
              </div>
            </div>
          ))}
          {matches.length === 0 && <p className="text-gray-500 italic p-4 bg-gray-50 rounded-lg text-center">No pending matches to review.</p>}
        </div>
      )}
    </div>
  );
}
