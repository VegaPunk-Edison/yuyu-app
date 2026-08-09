import { useState, useEffect, useRef } from 'react';

// ── Job + Arbeitgeber ────────────────────────────────────────────────────────
// Zwei-Stufen-Wizard wie GoalForm/TodoWizardInput: erst Job-Titel (Freitext), dann Arbeitgeber -
// aber als feste Liste von Buttons statt Freitext-Autocomplete, da der Arbeitgeber nur aus der
// kuratierten Supabase-Tabelle "employers" kommen darf.
export default function JobEmployerForm({ employers, initialJobTitle, initialEmployerId, onSubmit, onCancel }) {
  const [stage, setStage] = useState('jobtitle');
  const [jobTitle, setJobTitle] = useState(initialJobTitle || '');
  const inputRef = useRef(null);

  useEffect(() => {
    if (stage === 'jobtitle') inputRef.current?.focus();
  }, [stage]);

  const handleKeyDown = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (!jobTitle.trim()) return;
    setStage('employer');
  };

  const chooseEmployer = (employerId) => {
    onSubmit(jobTitle.trim(), employerId);
  };

  return (
    <div className="max-w-sm">
      {stage === 'jobtitle' ? (
        <input
          ref={inputRef}
          type="text"
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Aktueller Job, z.B. eSport"
          className="w-full px-0 py-2 bg-white text-slate-900 border-b border-slate-200 placeholder-slate-400 focus:border-blue-500 outline-none font-light text-base"
        />
      ) : (
        <div>
          <p className="text-sm text-slate-900 mb-3">{jobTitle}</p>
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Arbeitgeber (optional)</p>
          <div className="space-y-1">
            {employers.map(employer => (
              <button
                key={employer.id}
                type="button"
                onClick={() => chooseEmployer(employer.id)}
                className={`block w-full text-left px-3 py-2 text-sm rounded-lg border transition ${
                  employer.id === initialEmployerId
                    ? 'border-blue-300 text-blue-700 bg-blue-50'
                    : 'border-slate-200 text-slate-700 hover:bg-blue-50'
                }`}
              >
                {employer.name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => chooseEmployer(null)}
              className="block w-full text-left px-3 py-2 text-sm text-slate-400 hover:text-blue-600 transition"
            >
              Kein Arbeitgeber
            </button>
          </div>
        </div>
      )}
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="mt-3 text-xs text-slate-400 hover:text-blue-600 font-light transition"
        >
          Abbrechen
        </button>
      )}
    </div>
  );
}
