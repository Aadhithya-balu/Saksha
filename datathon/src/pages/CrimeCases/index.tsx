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
    <div className="w-full h-full min-h-[80vh] flex flex-col font-mono text-[var(--text-primary)]">
      {view === 'list' && (
        <CrimeCasesList
          onSelectCase={handleSelectCase}
          onCreateCase={() => setView('create')}
          onEditCase={handleEditCase}
        />
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
          onBack={() => setView('list')}
          onEdit={() => setView('edit')}
        />
      )}

      {view === 'edit' && selectedCaseId && (
        <EditCrimeCase
          caseId={selectedCaseId}
          onCancel={() => setView('list')}
          onSuccess={() => setView('list')}
        />
      )}
    </div>
  );
};

export default CrimeCases;