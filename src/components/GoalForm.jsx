import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { GOAL_TITLE_MAX_LENGTH } from '../lib/constants.js';

// Ziel anlegen: ein einziges Textfeld wandert per Enter durch die Stufen Lebensbereich (optional)
// -> Titel (Pflicht, zeichenbegrenzt) -> gewünschtes Ergebnis (Pflicht) -> Tugend(en, mehrfach
// möglich, optional). Jede Antwort wird oben als Zusammenfassung angezeigt; am Ende bestätigt
// ein "Speichern"-Klick oder leeres Enter auf der letzten Stufe das Ziel auf einmal.
export default function GoalForm({ virtues, skills, habits, lifeAreas, virtueGroups, skillGroups, habitGroups, onCreateVirtue, onCreateSkill, onCreateHabit, onSubmit }) {
  const [stage, setStage] = useState('lifearea');
  const [value, setValue] = useState('');
  const [lifeArea, setLifeArea] = useState(null);
  const [title, setTitle] = useState('');
  const [problem, setProblem] = useState('');
  const [description, setDescription] = useState('');
  const [linkedIds, setLinkedIds] = useState([]);
  const [linkedSkillIds, setLinkedSkillIds] = useState([]);
  const [linkedHabitIds, setLinkedHabitIds] = useState([]);
  const [pendingGroupItemName, setPendingGroupItemName] = useState('');
  const [creatingNewGroup, setCreatingNewGroup] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const inputRef = useRef(null);
  const isFirstRender = useRef(true);

  // Fokus wandert mit, damit man ohne erneutes Antippen weiterschreiben kann - auch wenn sich
  // innerhalb der virtue-group/skill-group-Stufe zwischen Liste und "neue Oberkategorie"-Eingabe umschaltet.
  // Beim allerersten Rendern NICHT automatisch fokussieren, sonst poppt das Vorschläge-Dropdown der
  // ersten Stufe sofort auf, ohne dass draufgeklickt wurde.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    inputRef.current?.focus();
  }, [stage, creatingNewGroup]);

  // Zeigt Vorschläge als durchsuchbares Dropdown, aber erst sobald das Feld angeklickt/fokussiert
  // wurde - nicht direkt beim Öffnen der Stufe.
  const lifeAreaSuggestions = stage === 'lifearea' && inputFocused
    ? lifeAreas.filter(a => a.name.toLowerCase().includes(value.toLowerCase())).slice(0, 5)
    : [];

  const virtueSuggestions = stage === 'virtue' && inputFocused
    ? virtues.filter(v => v.name.toLowerCase().includes(value.toLowerCase()) && !linkedIds.includes(v.id)).slice(0, 5)
    : [];

  const skillSuggestions = stage === 'skill' && inputFocused
    ? skills.filter(s => s.name.toLowerCase().includes(value.toLowerCase()) && !linkedSkillIds.includes(s.id)).slice(0, 5)
    : [];

  const habitSuggestions = stage === 'habit' && inputFocused
    ? habits.filter(h => h.name.toLowerCase().includes(value.toLowerCase()) && !linkedHabitIds.includes(h.id)).slice(0, 5)
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

  // Oberkategorie für eine spontan angelegte Tugend/Fähigkeit/Gewohnheit festlegen - entweder eine
  // vorhandene per id (Klick aus der Liste) oder eine neue mit diesem Namen (aus dem "+ Neue
  // Oberkategorie"-Feld). Welcher Typ gemeint ist, ergibt sich aus der aktuellen Stufe.
  const pickGroup = async (groupId, newGroupName) => {
    if (stage === 'virtue-group') {
      const newVirtue = groupId
        ? await onCreateVirtue(pendingGroupItemName, groupId, null)
        : await onCreateVirtue(pendingGroupItemName, null, newGroupName);
      if (newVirtue) addVirtue(newVirtue);
      setStage('virtue');
    } else if (stage === 'skill-group') {
      const newSkill = groupId
        ? await onCreateSkill(pendingGroupItemName, groupId, null)
        : await onCreateSkill(pendingGroupItemName, null, newGroupName);
      if (newSkill) addSkill(newSkill);
      setStage('skill');
    } else {
      const newHabit = groupId
        ? await onCreateHabit(pendingGroupItemName, groupId, null)
        : await onCreateHabit(pendingGroupItemName, null, newGroupName);
      if (newHabit) addHabit(newHabit);
      setStage('habit');
    }
    setPendingGroupItemName('');
    setValue('');
    setCreatingNewGroup(false);
  };

  const reset = () => {
    setStage('lifearea');
    setValue('');
    setLifeArea(null);
    setTitle('');
    setProblem('');
    setDescription('');
    setLinkedIds([]);
    setLinkedSkillIds([]);
    setLinkedHabitIds([]);
    setPendingGroupItemName('');
    setCreatingNewGroup(false);
  };

  const save = async () => {
    if (!title.trim()) return;
    // Formular nur bei tatsächlichem Erfolg zurücksetzen - schlägt das Speichern fehl (z.B.
    // Supabase-Fehler), bleiben die eingegebenen Antworten erhalten statt kommentarlos zu verschwinden.
    const ok = await onSubmit({ lifeAreaId: lifeArea?.id || null, title, problem, description, linkedIds, linkedSkillIds, linkedHabitIds });
    if (ok !== false) reset();
  };

  // Eine Stufe zurück - z.B. um eine Antwort zu korrigieren; die vorherige Eingabe landet
  // wieder editierbar im Feld, ihr bestätigter Wert wird dafür aus der Zusammenfassung entfernt.
  const goBack = () => {
    if (stage === 'title') {
      setValue(lifeArea?.name || '');
      setLifeArea(null);
      setStage('lifearea');
      return;
    }
    if (stage === 'problem') {
      setValue(title);
      setTitle('');
      setStage('title');
      return;
    }
    if (stage === 'outcome') {
      setValue(problem);
      setProblem('');
      setStage('problem');
      return;
    }
    if (stage === 'virtue') {
      setValue(description);
      setDescription('');
      setStage('outcome');
      return;
    }
    if (stage === 'virtue-group' || stage === 'skill-group' || stage === 'habit-group') {
      if (creatingNewGroup) {
        setCreatingNewGroup(false);
        setValue('');
        return;
      }
      setValue(pendingGroupItemName);
      setPendingGroupItemName('');
      setStage(stage === 'virtue-group' ? 'virtue' : stage === 'skill-group' ? 'skill' : 'habit');
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
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Backspace' && value === '' && stage !== 'lifearea') {
      e.preventDefault();
      goBack();
      return;
    }

    if (e.key !== 'Enter') return;
    e.preventDefault();

    if (stage === 'lifearea') {
      // Ohne Texteingabe ist die Stufe optional übersprungen - leeres Enter darf NICHT den ersten
      // Dropdown-Eintrag auswählen, sonst ließe sich der Lebensbereich nie leer lassen.
      if (value.trim()) {
        const match = lifeAreaSuggestions.length > 0
          ? lifeAreaSuggestions[0]
          : lifeAreas.find(a => a.name.toLowerCase() === value.trim().toLowerCase());
        if (match) setLifeArea(match);
      }
      setValue('');
      setStage('title');
      return;
    }

    if (stage === 'title') {
      if (!value.trim()) return;
      setTitle(value.trim());
      setValue('');
      setStage('problem');
      return;
    }

    if (stage === 'problem') {
      // Optional wie der Lebensbereich - leeres Enter überspringt die Stufe.
      if (value.trim()) setProblem(value.trim());
      setValue('');
      setStage('outcome');
      return;
    }

    if (stage === 'outcome') {
      if (value.trim()) setDescription(value.trim());
      setValue('');
      setStage('virtue');
      return;
    }

    if (stage === 'virtue') {
      // Leeres Enter (Dropdown nur zum Durchklicken sichtbar) darf nicht automatisch den ersten
      // Eintrag verknüpfen, sonst käme man mit leerem Feld nie zur nächsten Stufe.
      if (value.trim() && virtueSuggestions.length > 0) {
        addVirtue(virtueSuggestions[0]);
        return;
      }
      const match = value.trim() && virtues.find(v => v.name.toLowerCase() === value.trim().toLowerCase());
      if (match) {
        addVirtue(match);
        return;
      }
      // Kein Treffer, aber ein getippter Name: Tugend gibt es noch nicht - da sie zwingend
      // einer Oberkategorie angehören muss, erst dort auswählen/anlegen statt sie zu verwerfen.
      if (value.trim()) {
        setPendingGroupItemName(value.trim());
        setValue('');
        setStage('virtue-group');
        return;
      }
      setValue('');
      setStage('skill');
      return;
    }

    if (stage === 'virtue-group' || stage === 'skill-group' || stage === 'habit-group') {
      // Nur die "+ Neue Oberkategorie"-Eingabe ist ein Textfeld - vorhandene werden per Klick
      // aus der Liste gewählt (pickGroup), nicht getippt.
      if (creatingNewGroup && value.trim()) pickGroup(null, value.trim());
      return;
    }

    if (stage === 'skill') {
      // leeres Enter darf nicht automatisch den ersten Dropdown-Eintrag verknüpfen, sonst könnte
      // man diese Stufe mit leerem Feld nie verlassen.
      if (value.trim() && skillSuggestions.length > 0) {
        addSkill(skillSuggestions[0]);
        return;
      }
      const skillMatch = value.trim() && skills.find(s => s.name.toLowerCase() === value.trim().toLowerCase());
      if (skillMatch) {
        addSkill(skillMatch);
        return;
      }
      // Kein Treffer, aber ein getippter Name: Fähigkeit gibt es noch nicht - braucht wie Tugenden
      // zwingend eine Oberkategorie, erst dort auswählen/anlegen statt zu verwerfen.
      if (value.trim()) {
        setPendingGroupItemName(value.trim());
        setValue('');
        setStage('skill-group');
        return;
      }
      setValue('');
      setStage('habit');
      return;
    }

    // stage === 'habit' - gleiches Muster wie virtue/skill, letzte Stufe vor dem Speichern.
    if (value.trim() && habitSuggestions.length > 0) {
      addHabit(habitSuggestions[0]);
      return;
    }
    const habitMatch = value.trim() && habits.find(h => h.name.toLowerCase() === value.trim().toLowerCase());
    if (habitMatch) {
      addHabit(habitMatch);
      return;
    }
    if (value.trim()) {
      setPendingGroupItemName(value.trim());
      setValue('');
      setStage('habit-group');
      return;
    }
    save();
  };

  const placeholders = {
    lifearea: 'Welchem Lebensbereich zuordnen? (optional)',
    title: 'Was möchtest du erreichen?',
    problem: 'Welches Problem löst du? (optional)',
    outcome: 'Was ist dein gewünschter Ausgang? (optional)',
    virtue: 'Tugend eingeben (mehrere möglich), Enter zum Bestätigen',
    'virtue-group': 'Name der neuen Oberkategorie',
    skill: 'Fähigkeit eingeben (mehrere möglich), Enter zum Bestätigen',
    'skill-group': 'Name der neuen Oberkategorie',
    habit: 'Gewohnheit eingeben (mehrere möglich), Enter zum Bestätigen',
    'habit-group': 'Name der neuen Oberkategorie',
  };

  return (
    <div>
      {(lifeArea || title || problem || description) && (
        <div className="mb-2 space-y-0.5">
          {lifeArea && <p className="text-xs text-blue-600 font-light">{lifeArea.name}</p>}
          {title && <p className="text-sm text-slate-900">{title}</p>}
          {problem && <p className="text-xs text-slate-500 font-light">{problem}</p>}
          {description && <p className="text-xs text-slate-500 font-light">{description}</p>}
        </div>
      )}
      {(linkedIds.length > 0 || linkedSkillIds.length > 0 || linkedHabitIds.length > 0) && (
        <div className="flex flex-wrap gap-1.5 mb-2">
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

      {stage === 'virtue-group' || stage === 'skill-group' || stage === 'habit-group' ? (
        <div>
          <p className="text-xs text-slate-500 font-light mb-2">
            Neue {stage === 'virtue-group' ? 'Tugend' : stage === 'skill-group' ? 'Fähigkeit' : 'Gewohnheit'} "{pendingGroupItemName}" - Oberkategorie wählen:
          </p>
          {!creatingNewGroup ? (
            <div className="space-y-1.5">
              {(stage === 'virtue-group' ? virtueGroups : stage === 'skill-group' ? skillGroups : habitGroups).map(g => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => pickGroup(g.id, null)}
                  className="block w-full text-left px-3 py-2 text-sm rounded-lg border border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50 transition"
                >
                  {g.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCreatingNewGroup(true)}
                className="block w-full text-left px-3 py-2 text-sm text-blue-600 hover:text-blue-700 font-light transition"
              >
                + Neue Oberkategorie
              </button>
            </div>
          ) : (
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholders[stage]}
              className="w-full px-0 py-2 bg-white text-slate-900 border-b border-slate-200 placeholder-slate-400 focus:border-blue-500 outline-none font-light text-base"
            />
          )}
        </div>
      ) : (
        <div className="relative">
          {stage === 'title' ? (
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value.slice(0, GOAL_TITLE_MAX_LENGTH))}
              onKeyDown={handleKeyDown}
              maxLength={GOAL_TITLE_MAX_LENGTH}
              placeholder={placeholders.title}
              className="w-full px-0 py-2 bg-white text-slate-900 border-b border-slate-200 placeholder-slate-400 focus:border-blue-500 outline-none font-light text-base"
            />
          ) : stage === 'problem' || stage === 'outcome' ? (
            <textarea
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholders[stage]}
              rows={2}
              className="w-full px-0 py-2 bg-white text-slate-900 border-b border-slate-200 placeholder-slate-400 focus:border-blue-500 outline-none font-light text-sm resize-none"
            />
          ) : (
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder={placeholders[stage]}
              className="w-full px-0 py-2 bg-white text-slate-900 border-b border-slate-200 placeholder-slate-400 focus:border-blue-500 outline-none font-light text-base"
            />
          )}
          {stage === 'lifearea' && lifeAreaSuggestions.length > 0 && (
            <div className="absolute z-10 mt-1 min-w-[10rem] bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
              {lifeAreaSuggestions.map(a => (
                <button
                  key={a.id}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); setLifeArea(a); setValue(''); setStage('title'); }}
                  className="block w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 transition"
                >
                  {a.name}
                </button>
              ))}
            </div>
          )}
          {stage === 'virtue' && virtueSuggestions.length > 0 && (
            <div className="absolute z-10 mt-1 min-w-[10rem] bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
              {virtueSuggestions.map(v => (
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
        </div>
      )}

      {stage === 'title' && <p className="text-[10px] text-slate-400 font-light mt-1 text-right">{value.length}/{GOAL_TITLE_MAX_LENGTH}</p>}

      <div className="flex items-center gap-4 mt-3">
        {stage !== 'lifearea' && (
          <button
            onClick={goBack}
            className="text-sm text-slate-400 hover:text-blue-600 font-light transition"
          >
            ← Zurück
          </button>
        )}
        {stage === 'habit' && (
          <button
            onClick={save}
            className="text-sm text-blue-600 hover:text-blue-700 font-light transition"
          >
            Ziel speichern
          </button>
        )}
      </div>
    </div>
  );
}
