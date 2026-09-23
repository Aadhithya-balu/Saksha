import React, { useEffect, useState } from 'react';
import { 
  createCrimeCase, 
  createCriminal, 
  createVictim,
  createFIR, 
  listCriminals, 
  getCrimeCategories, 
  getLocationsList, 
  getUnassignedOfficers, 
  type OfficerWithUserRecord 
} from '../../services/api';
import type { CrimeCategoryRecord, LocationSimpleRecord } from '../../services/api';
import { ArrowLeft, Save, AlertTriangle, ShieldCheck, UserPlus } from 'lucide-react';

interface CreateCrimeCaseProps {
  onCancel: () => void;
  onSuccess: () => void;
  intent?: 'assign' | 'missing';
}

const CreateCrimeCase: React.FC<CreateCrimeCaseProps> = ({
  onCancel,
  onSuccess,
  intent,
}) => {
  const [categories, setCategories] = useState<CrimeCategoryRecord[]>([]);
  const [locations, setLocations] = useState<LocationSimpleRecord[]>([]);
  const [officers, setOfficers] = useState<OfficerWithUserRecord[]>([]);

  // Form Fields
  const [caseNumber, setCaseNumber] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [occurredAt, setOccurredAt] = useState('');
  const [description, setDescription] = useState(intent === 'missing' ? 'Missing person report recorded via dashboard quick action.' : '');
  const [moTags, setMoTags] = useState('');
  const [status, setStatus] = useState('active');
  const [foundByPolice, setFoundByPolice] = useState(intent === 'assign');
  const [assignedOfficerId, setAssignedOfficerId] = useState('');

  // Optional accused / criminal linkage fields
  const [accusedNames, setAccusedNames] = useState('');
  const [complainantName, setComplainantName] = useState('');

  // Optional victim basic-details fields
  const [victimName, setVictimName] = useState('');
  const [victimGender, setVictimGender] = useState('');
  const [victimAge, setVictimAge] = useState('');
  const [victimContact, setVictimContact] = useState('');
  const [victimAddress, setVictimAddress] = useState('');
  const [victimStatement, setVictimStatement] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const year = new Date().getFullYear();
    setCaseNumber(`CR-${year}-BLR-`);

    // Load category, location, and officer lists
    Promise.all([getCrimeCategories(), getLocationsList(), getUnassignedOfficers()])
      .then(([cats, locs, offs]) => {
        setCategories(cats);
        setLocations(locs);
        setOfficers(offs || []);
        if (cats.length > 0) {
          if (intent === 'missing') {
            const missingCat = cats.find(c => c.name.toLowerCase().includes('missing'));
            setCategoryId(missingCat?.id ?? cats[0].id);
          } else {
            setCategoryId(cats[0].id);
          }
        }
        if (locs.length > 0) setLocationId(locs[0].id);
      })
      .catch((err) => {
        console.error('Error loading dropdown data:', err);
        setError('Failed to fetch categories, locations, or officers from backend.');
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseNumber.trim() || !categoryId || !locationId || !occurredAt) {
      setError('PLEASE SPECIFY ALL MANDATORY CLASSIFICATION FIELDS.');
      return;
    }

    if (foundByPolice && !assignedOfficerId) {
      setError('Officer is required when the crime is found by police.');
      return;
    }

    const names = accusedNames
      .split(/[\n,;]/)
      .map(n => n.trim())
      .filter(Boolean);

    if (names.length > 0 && complainantName.trim().length < 3) {
      setError('PLEASE PROVIDE A COMPLAINANT NAME (3+ CHARS) TO LINK THE ACCUSED VIA FIR.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = {
        case_number: caseNumber,
        category_id: categoryId,
        location_id: locationId,
        occurred_at: occurredAt,
        description: description || null,
        mo_tags: moTags || null,
        status: status,
        assigned_officer_id: assignedOfficerId || null,
        found_by_police: foundByPolice,
      };

      const created = await createCrimeCase(payload as any);

      // Optional: link accused criminals through an auto-created FIR
      if (names.length > 0 && created?.id) {
        const criminalIds: string[] = [];
        for (const name of names) {
          const search = await listCriminals(name, 1, 5).catch(() => null);
          let existing = search?.results?.find(
            c => c.full_name.toLowerCase() === name.toLowerCase()
          );
          if (!existing) {
            existing = await createCriminal({ full_name: name, status: 'at_large' });
          }
          if (existing?.id) criminalIds.push(existing.id);
        }

        // Optional: create & link the victim when basic details were provided
        const victimIds: string[] = [];
        let complainantNameValue = complainantName.trim();
        if (victimName.trim()) {
          const createdVictim = await createVictim({
            full_name: victimName.trim(),
            gender: victimGender || null,
            age: victimAge ? Number(victimAge) : null,
            contact_number: victimContact.trim() || null,
            address: victimAddress.trim() || null,
            statement: victimStatement.trim() || null,
          }).catch(() => null);
          if (createdVictim?.id) victimIds.push(createdVictim.id);
          if (!complainantNameValue && !foundByPolice) {
            complainantNameValue = victimName.trim();
          }
        }

        const year = new Date().getFullYear();
        const station = locationId ? (locations.find(l => l.id === locationId)?.station || 'PS') : 'PS';
        const firNumber = `FIR-NEW/${station.replace(/[^A-Z0-9]/gi, '').slice(0, 10).toUpperCase()}/${year}`;

        await createFIR({
          fir_number: firNumber,
          crime_case_id: created.id,
          complainant_name: complainantNameValue,
          sections: moTags || null,
          narrative: description || null,
          status: 'registered',
          criminal_ids: criminalIds,
          victim_ids: victimIds.length > 0 ? victimIds : undefined,
          investigating_officer_id: assignedOfficerId || null,
          found_by_police: foundByPolice,
        });
      } else if (victimName.trim() && created?.id) {
        // No accused listed but a victim was provided — still register the FIR
        const createdVictim = await createVictim({
          full_name: victimName.trim(),
          gender: victimGender || null,
          age: victimAge ? Number(victimAge) : null,
          contact_number: victimContact.trim() || null,
          address: victimAddress.trim() || null,
          statement: victimStatement.trim() || null,
        }).catch(() => null);

        const year = new Date().getFullYear();
        const station = locationId ? (locations.find(l => l.id === locationId)?.station || 'PS') : 'PS';
        const firNumber = `FIR-NEW/${station.replace(/[^A-Z0-9]/gi, '').slice(0, 10).toUpperCase()}/${year}`;
        let complainantNameValue = complainantName.trim();
        if (!complainantNameValue && !foundByPolice) {
          complainantNameValue = victimName.trim();
        }

        await createFIR({
          fir_number: firNumber,
          crime_case_id: created.id,
          complainant_name: complainantNameValue,
          sections: moTags || null,
          narrative: description || null,
          status: 'registered',
          criminal_ids: undefined,
          victim_ids: createdVictim?.id ? [createdVictim.id] : undefined,
          investigating_officer_id: assignedOfficerId || null,
          found_by_police: foundByPolice,
        });
      }

      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Failed to create crime case record.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Page Header */}
      <div className="flex justify-between items-center pb-4 border-b border-border-color">
        <button
          onClick={onCancel}
          className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer text-xs uppercase font-bold"
        >
          <ArrowLeft className="w-4 h-4" /> Cancel Enrolment
        </button>
        <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">Crime Case Registry Enrolment</h2>
      </div>

      {error && (
        <div className="p-4 border border-[#C94A2A]/20 bg-[#C94A2A]/5 text-[#C94A2A] rounded text-xs flex items-center gap-3 font-mono">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main input form */}
      <form onSubmit={handleSubmit} className="p-6 bg-secondary-bg border border-border-color rounded-card space-y-5 font-mono text-xs text-[var(--text-secondary)]">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Case Number */}
          <div className="flex flex-col gap-1.5">
            <label className="uppercase text-[10px] text-[var(--text-muted)] font-bold">Case Number *</label>
            <input
              type="text"
              required
              placeholder="e.g. CR-2026-BLR-8321"
              value={caseNumber}
              onChange={(e) => setCaseNumber(e.target.value)}
              className="px-3.5 py-2 bg-[var(--bg-tertiary)] border border-border-color rounded text-xs text-[var(--text-primary)] uppercase placeholder-[var(--text-muted)] focus:border-[#1E6FD9]/60 focus:outline-none"
            />
          </div>

          {/* Occurred At */}
          <div className="flex flex-col gap-1.5">
            <label className="uppercase text-[10px] text-[var(--text-muted)] font-bold">Date *</label>
            <input
              type="datetime-local"
              required
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              className="px-3.5 py-2 bg-[var(--bg-tertiary)] border border-border-color rounded text-xs text-[var(--text-primary)] uppercase focus:border-[#1E6FD9]/60 focus:outline-none"
            />
          </div>

          {/* Crime Category */}
          <div className="flex flex-col gap-1.5">
            <label className="uppercase text-[10px] text-[var(--text-muted)] font-bold">Category *</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="px-3.5 py-2 bg-[var(--bg-tertiary)] border border-border-color rounded text-xs text-[var(--text-primary)] cursor-pointer focus:border-[#1E6FD9]/60 focus:outline-none"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.section_code ? `(${c.section_code})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Incident Location */}
          <div className="flex flex-col gap-1.5">
            <label className="uppercase text-[10px] text-[var(--text-muted)] font-bold">Location *</label>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="px-3.5 py-2 bg-[var(--bg-tertiary)] border border-border-color rounded text-xs text-[var(--text-primary)] cursor-pointer focus:border-[#1E6FD9]/60 focus:outline-none"
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.district} - {loc.station} {loc.pincode ? `(${loc.pincode})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Crime Discovery & Officer Attribution */}
        <div className="p-4 bg-[var(--bg-tertiary)]/40 border border-border-color rounded space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="foundByPolice"
              checked={foundByPolice}
              onChange={(e) => {
                setFoundByPolice(e.target.checked);
                if (!e.target.checked) setError(null);
              }}
              className="w-4 h-4 text-[#1E6FD9] rounded border-border-color bg-[var(--bg-secondary)] cursor-pointer"
            />
            <label htmlFor="foundByPolice" className="uppercase text-[10px] text-[var(--text-primary)] font-bold cursor-pointer select-none flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#1E6FD9]" />
              Crime Found / Identified by Police (Suo Motu Discovery)
            </label>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="uppercase text-[10px] text-[var(--text-muted)] font-bold flex items-center justify-between">
              <span>Responsible / Investigating Officer {foundByPolice ? <span className="text-red-500">* (Mandatory)</span> : <span className="text-[var(--text-muted)] font-normal">(Optional)</span>}</span>
            </label>
            <select
              value={assignedOfficerId}
              onChange={(e) => {
                setAssignedOfficerId(e.target.value);
                if (e.target.value) setError(null);
              }}
              className={`px-3.5 py-2 bg-[var(--bg-secondary)] border rounded text-xs text-[var(--text-primary)] cursor-pointer focus:outline-none ${
                foundByPolice && !assignedOfficerId
                  ? 'border-red-500/70 focus:border-red-500'
                  : 'border-border-color focus:border-[#1E6FD9]/60'
              }`}
            >
              <option value="">{foundByPolice ? '-- Select Responsible Police Officer (Required) --' : '-- Unassigned (Assign Officer Later) --'}</option>
              {officers.map((off) => (
                <option key={off.id} value={off.id}>
                  {off.badge_number} - {off.full_name} ({off.rank || 'Officer'}, {off.station})
                </option>
              ))}
            </select>
            {foundByPolice && !assignedOfficerId && (
              <span className="text-[9.5px] text-red-400 font-mono">
                Officer is required when the crime is found by police.
              </span>
            )}
          </div>
        </div>

        {/* MO Tags */}
        <div className="flex flex-col gap-1.5">
          <label className="uppercase text-[10px] text-[var(--text-muted)] font-bold">Crime Type / MO Tags</label>
          <input
            type="text"
            placeholder="e.g. night-trespass, safe-cracking, lock-break"
            value={moTags}
            onChange={(e) => setMoTags(e.target.value)}
            className="px-3.5 py-2 bg-[var(--bg-tertiary)] border border-border-color rounded text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[#1E6FD9]/60 focus:outline-none"
          />
        </div>

        {/* Case Status */}
        <div className="flex flex-col gap-1.5">
          <label className="uppercase text-[10px] text-[var(--text-muted)] font-bold">Initial Process Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3.5 py-2 bg-[var(--bg-tertiary)] border border-border-color rounded text-xs text-[var(--text-primary)] cursor-pointer focus:border-[#1E6FD9]/60 focus:outline-none"
          >
            <option value="active">ACTIVE</option>
            <option value="under_investigation">UNDER INVESTIGATION</option>
          </select>
          <span className="text-[9.5px] text-[var(--text-muted)] font-mono">
            ARRESTED / CONVICTED statuses cannot be set at creation time.
          </span>
        </div>

        {/* Description Statement */}
        <div className="flex flex-col gap-1.5">
          <label className="uppercase text-[10px] text-[var(--text-muted)] font-bold">Description</label>
          <textarea
            placeholder="ENTER COMPREHENSIVE DESCRIPTION DETAILS RELEVANT TO THIS ACTIVE INTELLIGENCE FILE..."
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-3.5 bg-[var(--bg-tertiary)] border border-border-color rounded text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[#1E6FD9]/60 focus:outline-none resize-none uppercase"
          />
        </div>

        {/* Optional Accused / Criminal Names */}
        <div className="border border-border-color/40 rounded p-4 space-y-4">
          <div className="flex items-center justify-between">
            <label className="uppercase text-[10px] text-[var(--text-muted)] font-bold">Accused / Criminal Name(s) (Optional)</label>
            {accusedNames.trim() && (
              <span className="text-[10px] text-[var(--accent-teal)] uppercase font-bold">Will auto-create linked FIR</span>
            )}
          </div>
          <textarea
            placeholder="e.g. Ramu Swamy, Vikram Yadav (one per line, comma or semicolon separated). Leave blank if no accused is known yet."
            rows={3}
            value={accusedNames}
            onChange={(e) => setAccusedNames(e.target.value)}
            className="w-full p-3.5 bg-[var(--bg-tertiary)] border border-border-color rounded text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[#1E6FD9]/60 focus:outline-none resize-none"
          />
          {accusedNames.trim().length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="uppercase text-[10px] text-[var(--text-muted)] font-bold">Complainant Name (required to register FIR) *</label>
              <input
                type="text"
                placeholder="e.g. Anil Kumar"
                value={complainantName}
                onChange={(e) => setComplainantName(e.target.value)}
                className="px-3.5 py-2 bg-[var(--bg-tertiary)] border border-border-color rounded text-xs text-[var(--text-primary)] focus:border-[#1E6FD9]/60 focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* Optional Victim Basic Details */}
        <div className="border border-border-color/40 rounded p-4 space-y-4">
          <div className="flex items-center gap-2">
            <UserPlus className="w-3.5 h-3.5 text-[var(--accent-teal)]" />
            <label className="uppercase text-[10px] text-[var(--text-muted)] font-bold">Victim Basic Details (Optional)</label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="uppercase text-[10px] text-[var(--text-muted)] font-bold">Victim Full Name</label>
              <input
                type="text"
                placeholder="e.g. Meena Kumar"
                value={victimName}
                onChange={(e) => setVictimName(e.target.value)}
                className="px-3.5 py-2 bg-[var(--bg-tertiary)] border border-border-color rounded text-xs text-[var(--text-primary)] focus:border-[#1E6FD9]/60 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="uppercase text-[10px] text-[var(--text-muted)] font-bold">Gender</label>
                <select
                  value={victimGender}
                  onChange={(e) => setVictimGender(e.target.value)}
                  className="px-3.5 py-2 bg-[var(--bg-tertiary)] border border-border-color rounded text-xs text-[var(--text-primary)] cursor-pointer focus:border-[#1E6FD9]/60 focus:outline-none"
                >
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="uppercase text-[10px] text-[var(--text-muted)] font-bold">Age</label>
                <input
                  type="number"
                  min="0"
                  max="130"
                  placeholder="e.g. 34"
                  value={victimAge}
                  onChange={(e) => setVictimAge(e.target.value)}
                  className="px-3.5 py-2 bg-[var(--bg-tertiary)] border border-border-color rounded text-xs text-[var(--text-primary)] focus:border-[#1E6FD9]/60 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="uppercase text-[10px] text-[var(--text-muted)] font-bold">Contact Number</label>
              <input
                type="text"
                placeholder="e.g. 9845012345"
                value={victimContact}
                onChange={(e) => setVictimContact(e.target.value)}
                className="px-3.5 py-2 bg-[var(--bg-tertiary)] border border-border-color rounded text-xs text-[var(--text-primary)] focus:border-[#1E6FD9]/60 focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="uppercase text-[10px] text-[var(--text-muted)] font-bold">Address</label>
              <input
                type="text"
                placeholder="e.g. 14, 5th Main, Whitefield, Bengaluru"
                value={victimAddress}
                onChange={(e) => setVictimAddress(e.target.value)}
                className="px-3.5 py-2 bg-[var(--bg-tertiary)] border border-border-color rounded text-xs text-[var(--text-primary)] focus:border-[#1E6FD9]/60 focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="uppercase text-[10px] text-[var(--text-muted)] font-bold">Victim Statement</label>
              <textarea
                placeholder="Optional statement or remarks from the victim..."
                rows={2}
                value={victimStatement}
                onChange={(e) => setVictimStatement(e.target.value)}
                className="w-full p-3.5 bg-[var(--bg-tertiary)] border border-border-color rounded text-xs text-[var(--text-primary)] focus:border-[#1E6FD9]/60 focus:outline-none resize-none"
              />
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex justify-end gap-3 pt-3 border-t border-border-color/30">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-border-color hover:bg-[var(--bg-tertiary)]/10 rounded uppercase font-bold cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 bg-[#1E6FD9] hover:bg-[#1E6FD9]/80 disabled:opacity-50 transition-colors rounded uppercase font-bold text-[var(--text-primary)] cursor-pointer animate-pulse-slow"
          >
            <Save className="w-4 h-4" /> Create Case
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateCrimeCase;
