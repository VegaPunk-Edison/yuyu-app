import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

// Aufgabe anlegen: ein einziges Textfeld wandert per Enter durch die Stufen
// Aufgabe -> Tugend(en, mehrfach möglich) -> Gewohnheit -> Lebensbereich.
// Leeres Enter überspringt die aktuelle (optionale) Stufe.
export default function TodoWizardInput({ virtues, skills, habits, lifeAreas, onSubmit, placeholder, className, wrapperClassName }) {
  const [stage, setStage] = useState('task');
  const [value, setValue] = useState('');
  const [taskText, setTaskText] = useState('');
  const [linkedIds, setLinkedIds] = useState([]);
  const [linkedSkillIds, setLinkedSkillIds] = useState([]);
  const [linkedHabitIds, setLinkedHabitIds] = useState([]);
  const inputRef = useRef(null);

  // Fokus wandert mit, damit man ohne erneutes Antippen weiterschreiben kann
  useEffect(() => {
    inputRef.current?.focus();
  }, [stage]);

  const suggestions = stage === 'virtue' && value
    ? virtues.filter(v => v.name.toLowerCase().includes(value.toLowerCase()) && !linkedIds.includes(v.id)).slice(0, 5)
    : [];

  const skillSuggestions = stage === 'skill' && value
    ? skills.filter(s => s.name.toLowerCase().includes(value.toLowerCase()) && !linkedSkillIds.includes(s.id)).slice(0, 5)
    : [];

  const habitSuggestions = stage === 'habit' && value
    ? habits.filter(h => h.name.toLowerCase().includes(value.toLowerCase()) && !linkedHabitIds.includes(h.id)).slice(0, 5)
    : [];

  const lifeAreaSuggestions = stage === 'lifearea' && value
    ? lifeAreas.filter(a => a.name.toLowerCase().includes(value.toLowerCase())).slice(0, 5)
    : [];

  const addVirtue = (virtue) => {
    setLinkedIds(prev => (prev.includes(virtue.id) ? prev : [...prev, virtue.id]));
    setValue('');
  };

  const removeVirtue = (id) => setLinkedIds(prev => prev.filter(i => i !== id));

  const addSkill = (skill) => {
    setLinkedSkillIds(prev => (prev.includes(skill.id) ? prev : [...prev, skill.id]));
    setValue('');
  };

  const removeSkill = (id) => setLinkedSkillIds(prev => prev.filter(i => i !== id));

  const addHabit = (habit) => {
    setLinkedHabitIds(prev => (prev.includes(habit.id) ? prev : [...prev, habit.id]));
    setValue('');
  };

  const removeHabit = (id) => setLinkedHabitIds(prev => prev.filter(i => i !== id));

  const reset = () => {
    setStage('task');
    setValue('');
    setTaskText('');
    setLinkedIds([]);
    setLinkedSkillIds([]);
    setLinkedHabitIds([]);
  };

  // Eine Stufe zurück - z.B. um eine Antwort zu korrigieren; die vorherige Eingabe landet
  // wieder editierbar im Feld, ihr bestätigter Wert wird dafür aus der Zusammenfassung entfernt.
  const goBack = () => {
    if (stage === 'virtue') {
      setValue(taskText);
      setTaskText('');
      setStage('task');
      return;
    }
    if (stage === 'skill') {
      setValue('');
      setStage('virtue');
      return;
    }
    if (stage === 'habit') {
      setValue('');
      setStage('skill');
      return;
    }
    if (stage === 'lifearea') {
      setValue('');
      setStage('habit');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Backspace' && value === '' && stage !== 'task') {
      e.preventDefault();
      goBack();
      return;
    }

    if (e.key !== 'Enter') return;
    e.preventDefault();

    if (stage === 'task') {
      if (!value.trim()) return;
      setTaskText(value.trim());
      setValue('');
      setStage('virtue');
      return;
    }

    if (stage === 'virtue') {
      if (suggestions.length > 0) {
        addVirtue(suggestions[0]);
        return;
      }
      const match = virtues.find(v => v.name.toLowerCase() === value.trim().toLowerCase());
      if (match) {
        addVirtue(match);
        return;
      }
      setValue('');
      setStage('skill');
      return;
    }

    if (stage === 'skill') {
      if (skillSuggestions.length > 0) {
        addSkill(skillSuggestions[0]);
        return;
      }
      const match = skills.find(s => s.name.toLowerCase() === value.trim().toLowerCase());
      if (match) {
        addSkill(match);
        return;
      }
      setValue('');
      setStage('habit');
      return;
    }

    if (stage === 'habit') {
      if (habitSuggestions.length > 0) {
        addHabit(habitSuggestions[0]);
        return;
      }
      const match = habits.find(h => h.name.toLowerCase() === value.trim().toLowerCase());
      if (match) {
        addHabit(match);
        return;
      }
      setValue('');
      setStage('lifearea');
      return;
    }

    // stage === 'lifearea'
    const match = lifeAreaSuggestions.length > 0
      ? lifeAreaSuggestions[0]
      : lifeAreas.find(a => a.name.toLowerCase() === value.trim().toLowerCase());
    onSubmit({ text: taskText, linkedIds, linkedSkillIds, linkedHabitIds, lifeAreaId: match?.id || null });
    reset();
  };

  const placeholders = {
    task: placeholder || '+ Aufgabe hinzufügen',
    virtue: 'Tugend eingeben (mehrere möglich), Enter zum Bestätigen',
    skill: 'Fähigkeit eingeben (mehrere möglich), Enter zum Bestätigen',
    habit: 'Gewohnheit eingeben (mehrere möglich), Enter zum Bestätigen',
    lifearea: 'Lebensbereich angeben (optional), Enter zum Abschließen',
  };

  return (
    <div className={wrapperClassName}>
      {stage !== 'task' && (
        <p className="text-xs text-slate-400 font-light mb-1.5">
          Aufgabe: <span className="text-slate-600">{taskText}</span>
        </p>
      )}
      {(linkedIds.length > 0 || linkedSkillIds.length > 0 || linkedHabitIds.length > 0) && (
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {linkedIds.map(id => {
            const v = virtues.find(vv => vv.id === id);
            if (!v) return null;
            return (
              <span key={`virtue-${id}`} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">
                {v.name}
                <button type="button" onClick={() => removeVirtue(id)} className="hover:text-blue-900">
                  <X className="w-3 h-3" strokeWidth={2} />
                </button>
              </span>
            );
          })}
          {linkedSkillIds.map(id => {
            const s = skills.find(ss => ss.id === id);
            if (!s) return null;
            return (
              <span key={`skill-${id}`} className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-50 text-violet-700 text-xs rounded-full">
                {s.name}
                <button type="button" onClick={() => removeSkill(id)} className="hover:text-violet-900">
                  <X className="w-3 h-3" strokeWidth={2} />
                </button>
              </span>
            );
          })}
          {linkedHabitIds.map(id => {
            const h = habits.find(hh => hh.id === id);
            if (!h) return null;
            return (
              <span key={`habit-${id}`} className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs rounded-full">
                {h.name}
                <button type="button" onClick={() => removeHabit(id)} className="hover:text-emerald-900">
                  <X className="w-3 h-3" strokeWidth={2} />
                </button>
              </span>
            );
          })}
        </div>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholders[stage]}
          className={className}
        />
        {stage === 'virtue' && suggestions.length > 0 && (
          <div className="absolute z-10 mt-1 min-w-[10rem] bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
            {suggestions.map(v => (
              <button
                key={v.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); addVirtue(v); }}
                className="block w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 transition"
              >
                {v.name}
              </button>
            ))}
          </div>
        )}
        {stage === 'skill' && skillSuggestions.length > 0 && (
          <div className="absolute z-10 mt-1 min-w-[10rem] bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
            {skillSuggestions.map(s => (
              <button
                key={s.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); addSkill(s); }}
                className="block w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 transition"
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
        {stage === 'habit' && habitSuggestions.length > 0 && (
          <div className="absolute z-10 mt-1 min-w-[10rem] bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
            {habitSuggestions.map(h => (
              <button
                key={h.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); addHabit(h); }}
                className="block w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 transition"
              >
                {h.name}
              </button>
            ))}
          </div>
        )}
        {stage === 'lifearea' && lifeAreaSuggestions.length > 0 && (
          <div className="absolute z-10 mt-1 min-w-[10rem] bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
            {lifeAreaSuggestions.map(a => (
              <button
                key={a.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSubmit({ text: taskText, linkedIds, linkedSkillIds, linkedHabitIds, lifeAreaId: a.id });
                  reset();
                }}
                className="block w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 transition"
              >
                {a.name}
              </button>
            ))}
          </div>
        )}
      </div>
      {stage !== 'task' && (
        <button
          onClick={goBack}
          className="mt-2 text-xs text-slate-400 hover:text-blue-600 font-light transition"
        >
          ← Zurück
        </button>
      )}
    </div>
  );
}
