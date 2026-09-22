import React, { useEffect, useState } from 'react';
import CrimeCasesList from './CrimeCasesList';
import CrimeCaseDetails from './CrimeCaseDetails';
import CreateCrimeCase from './CreateCrimeCase';
import EditCrimeCase from './EditCrimeCase';

type ViewMode = 'list' | 'create' | 'details' | 'edit';

const CrimeCases: React.FC = () => {
  const [view, setView] = useState<ViewMode>('list');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [intent, setIntent] = useState<'assign' | 'missing' | undefined>(undefined);

  useEffect(() => {
    const redirectId = sessionStorage.getItem('selected_entity_id');
    if (redirectId) {
      sessionStorage.removeItem('selected_entity_id');
      if (/^[0-9a-f-]{36}$/i.test(redirectId)) {
        setSelectedCaseId(redirectId);
        setView('details');
      }
    }

    const quickIntent = sessionStorage.getItem('quick_action_intent');
    if (quickIntent === 'Add Missing Person' || quickIntent === 'Assign Case') {
      sessionStorage.removeItem('quick_action_intent');
      setIntent(quickIntent === 'Assign Case' ? 'assign' : 'missing');
      setView('create');
    }
  }, []);

  const handleSelectCase = (id: string) => {
    setSelectedCaseId(id);
    setView('details');
  };

  const handleEditCase = (id: string) => {
    setSelectedCaseId(id);
    setView('edit');
  };

  return (
    <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-[var(--bg-primary)]">
      {/* LEFT PANE: Case List */}
      <div className="w-[320px] lg:w-[360px] shrink-0 border-r border-[var(--border-primary)] bg-[var(--bg-secondary)] flex flex-col overflow-y-auto z-10">
        <CrimeCasesList
          onSelectCase={handleSelectCase}
          onCreateCase={() => setView('create')}
          onEditCase={handleEditCase}
          selectedCaseId={selectedCaseId}
        />
      </div>

      {/* RIGHT PANE: Workspace Details */}
      <div className="flex-1 relative overflow-y-auto bg-[var(--bg-primary)]">
        {view === 'list' && (
          <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)]">
            <div className="w-16 h-16 rounded-full bg-[var(--bg-elevated)]/50 border border-[var(--border-primary)] flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-[#1E6FD9]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <p className="text-xs font-mono uppercase tracking-widest">Select an Investigation</p>
          </div>
        )}

        {view === 'create' && (
          <CreateCrimeCase
            intent={intent}
            onCancel={() => setView('list')}
            onSuccess={() => setView('list')}
          />
        )}

        {view === 'details' && selectedCaseId && (
          <CrimeCaseDetails
            caseId={selectedCaseId}
            onBack={() => setView('list')} // Keeping for prop compatibility if needed
            onEdit={() => setView('edit')}
          />
        )}

        {view === 'edit' && selectedCaseId && (
          <EditCrimeCase
            caseId={selectedCaseId}
            onCancel={() => setView('details')}
            onSuccess={() => setView('details')}
          />
        )}
      </div>
    </div>
  );
};

export default CrimeCases;
