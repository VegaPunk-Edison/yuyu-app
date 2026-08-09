import { useState } from 'react';
import { CheckCircle2, Circle, X } from 'lucide-react';
import GoalMilestones from './GoalMilestones.jsx';

// Detail-/Bearbeiten-Dialog für ein bestehendes Ziel - Titel, Problem, Ausgang,
// Tugenden/Fähigkeiten/Gewohnheiten und Lebensbereich lassen sich hier nachträglich
// ändern (bei der Erstellung im GoalForm-Wizard schon möglich, hier zusätzlich editierbar),
// dazu Meilensteine und alle mit diesem Ziel verknüpften Aufgaben.
export default function GoalDetailModal({ goal, virtues, skills, habits, lifeAreas, todos, onSave, onClose, onDelete, onAddMilestone, onToggleMilestone, onDeleteMilestone, onEditMilestone, onLinkTodo, onUnlinkTodo }) {
  const [title, setTitle] = useState(goal.title || goal.name || '');
  const [problem, setProblem] = useState(goal.problem || '');
  const [description, setDescription] = useState(goal.description || '');
  const [linkedItems, setLinkedItems] = useState(goal.linkedItems || []);
  const [linkedSkillIds, setLinkedSkillIds] = useState(goal.linkedSkillIds || []);
  const [linkedHabitIds, setLinkedHabitIds] = useState(goal.linkedHabitIds || []);
  const [lifeAreaId, setLifeAreaId] = useState(goal.lifeAreaId || null);
  const [virtueInput, setVirtueInput] = useState('');
  const [skillInput, setSkillInput] = useState('');
  const [habitInput, setHabitInput] = useState('');
  const [todoInput, setTodoInput] = useState('');

  const virtueSuggestions = virtueInput
    ? virtues.filter(v => v.name.toLowerCase().includes(virtueInput.toLowerCase()) && !linkedItems.includes(v.id)).slice(0, 5)
    : [];
  const skillSuggestions = skillInput
    ? skills.filter(s => s.name.toLowerCase().includes(skillInput.toLowerCase()) && !linkedSkillIds.includes(s.id)).slice(0, 5)
    : [];
  const habitSuggestions = habitInput
    ? habits.filter(h => h.name.toLowerCase().includes(habitInput.toLowerCase()) && !linkedHabitIds.includes(h.id)).slice(0, 5)
    : [];

  const linkedTodos = todos.filter(t => t.goalId === goal.id);
  const todoSuggestions = todoInput
    ? todos.filter(t => t.goalId !== goal.id && !t.completed && !t.failed && t.text.toLowerCase().includes(todoInput.toLowerCase())).slice(0, 5)
    : [];

  const addVirtue = (v) => { setLinkedItems(prev => (prev.includes(v.id) ? prev : [...prev, v.id])); setVirtueInput(''); };
  const removeVirtue = (id) => setLinkedItems(prev => prev.filter(i => i !== id));
  const addSkill = (s) => { setLinkedSkillIds(prev => (prev.includes(s.id) ? prev : [...prev, s.id])); setSkillInput(''); };
  const removeSkill = (id) => setLinkedSkillIds(prev => prev.filter(i => i !== id));
  const addHabit = (h) => { setLinkedHabitIds(prev => (prev.includes(h.id) ? prev : [...prev, h.id])); setHabitInput(''); };
  const removeHabit = (id) => setLinkedHabitIds(prev => prev.filter(i => i !== id));

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({ title, problem, description, linkedItems, linkedSkillIds, linkedHabitIds, lifeAreaId });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-md sm:rounded-xl rounded-t-2xl p-5 sm:p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-light text-slate-900">Ziel</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>

        <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1.5">Titel</label>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full mb-4 text-sm text-slate-900 border-b border-slate-200 focus:border-blue-400 outline-none py-1.5"
        />

        <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1.5">Problem</label>
        <textarea
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
          rows={2}
          placeholder="Welches Problem löst du? (optional)"
          className="w-full mb-4 text-sm text-slate-900 border-b border-slate-200 focus:border-blue-400 outline-none py-1.5 resize-none"
        />

        <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1.5">Ausgang</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Was ist dein gewünschter Ausgang? (optional)"
          className="w-full mb-4 text-sm text-slate-900 border-b border-slate-200 focus:border-blue-400 outline-none py-1.5 resize-none"
        />

        <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1.5">Tugenden</label>
        {linkedItems.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {linkedItems.map(id => {
              const v = virtues.find(vv => vv.id === id);
              if (!v) return null;
              return (
                <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">
                  {v.name}
                  <button type="button" onClick={() => removeVirtue(id)} className="hover:text-blue-900">
                    <X className="w-3 h-3" strokeWidth={2} />
                  </button>
                </span>
              );
            })}
          </div>
        )}
        <div className="relative mb-4">
          <input
            value={virtueInput}
            onChange={(e) => setVirtueInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && virtueSuggestions[0]) { e.preventDefault(); addVirtue(virtueSuggestions[0]); } }}
            placeholder="Tugend hinzufügen…"
            className="w-full text-sm text-slate-700 border-b border-slate-200 focus:border-blue-400 outline-none py-1.5"
          />
          {virtueSuggestions.length > 0 && (
            <div className="absolute z-10 mt-1 min-w-[10rem] bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
              {virtueSuggestions.map(v => (
                <button key={v.id} type="button" onMouseDown={(e) => { e.preventDefault(); addVirtue(v); }} className="block w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 transition">
                  {v.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1.5">Fähigkeiten</label>
        {linkedSkillIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {linkedSkillIds.map(id => {
              const s = skills.find(ss => ss.id === id);
              if (!s) return null;
              return (
                <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-50 text-violet-700 text-xs rounded-full">
                  {s.name}
                  <button type="button" onClick={() => removeSkill(id)} className="hover:text-violet-900">
                    <X className="w-3 h-3" strokeWidth={2} />
                  </button>
                </span>
              );
            })}
          </div>
        )}
        <div className="relative mb-4">
          <input
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && skillSuggestions[0]) { e.preventDefault(); addSkill(skillSuggestions[0]); } }}
            placeholder="Fähigkeit hinzufügen…"
            className="w-full text-sm text-slate-700 border-b border-slate-200 focus:border-blue-400 outline-none py-1.5"
          />
          {skillSuggestions.length > 0 && (
            <div className="absolute z-10 mt-1 min-w-[10rem] bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
              {skillSuggestions.map(s => (
                <button key={s.id} type="button" onMouseDown={(e) => { e.preventDefault(); addSkill(s); }} className="block w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 transition">
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1.5">Gewohnheiten</label>
        {linkedHabitIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {linkedHabitIds.map(id => {
              const h = habits.find(hh => hh.id === id);
              if (!h) return null;
              return (
                <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs rounded-full">
                  {h.name}
                  <button type="button" onClick={() => removeHabit(id)} className="hover:text-emerald-900">
                    <X className="w-3 h-3" strokeWidth={2} />
                  </button>
                </span>
              );
            })}
          </div>
        )}
        <div className="relative mb-4">
          <input
            value={habitInput}
            onChange={(e) => setHabitInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && habitSuggestions[0]) { e.preventDefault(); addHabit(habitSuggestions[0]); } }}
            placeholder="Gewohnheit hinzufügen…"
            className="w-full text-sm text-slate-700 border-b border-slate-200 focus:border-blue-400 outline-none py-1.5"
          />
          {habitSuggestions.length > 0 && (
            <div className="absolute z-10 mt-1 min-w-[10rem] bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
              {habitSuggestions.map(h => (
                <button key={h.id} type="button" onMouseDown={(e) => { e.preventDefault(); addHabit(h); }} className="block w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 transition">
                  {h.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1.5">Lebensbereich</label>
        <select
          value={lifeAreaId != null ? String(lifeAreaId) : ''}
          onChange={(e) => setLifeAreaId(e.target.value ? Number(e.target.value) : null)}
          className="w-full mb-4 text-sm text-slate-700 border-b border-slate-200 focus:border-blue-400 outline-none py-1.5 bg-white"
        >
          <option value="">Kein Lebensbereich</option>
          {lifeAreas.map(a => (
            <option key={a.id} value={String(a.id)}>{a.name}</option>
          ))}
        </select>

        <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1.5">Meilensteine</label>
        <div className="mb-4">
          <GoalMilestones goal={goal} onAdd={onAddMilestone} onToggle={onToggleMilestone} onDelete={onDeleteMilestone} onEdit={onEditMilestone} />
        </div>

        <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1.5">Verknüpfte Aufgaben</label>
        {linkedTodos.length > 0 && (
          <div className="space-y-1 mb-1.5">
            {linkedTodos.map(t => (
              <div key={t.id} className="flex items-center gap-2 group/todo">
                {t.completed ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" strokeWidth={1.5} />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" strokeWidth={1.5} />
                )}
                <span className={`flex-1 text-xs font-light ${t.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                  {t.text}
                </span>
                <button
                  type="button"
                  onClick={() => onUnlinkTodo(t.id)}
                  className="p-1 -m-1 text-slate-300 hover:text-red-500 transition opacity-0 group-hover/todo:opacity-100 flex-shrink-0"
                  title="Verknüpfung entfernen"
                >
                  <X className="w-3 h-3" strokeWidth={2} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="relative mb-6">
          <input
            value={todoInput}
            onChange={(e) => setTodoInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && todoSuggestions[0]) { e.preventDefault(); onLinkTodo(todoSuggestions[0].id); setTodoInput(''); } }}
            placeholder="Aufgabe verknüpfen…"
            className="w-full text-sm text-slate-700 border-b border-slate-200 focus:border-blue-400 outline-none py-1.5"
          />
          {todoSuggestions.length > 0 && (
            <div className="absolute z-10 mt-1 min-w-[10rem] bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
              {todoSuggestions.map(t => (
                <button key={t.id} type="button" onMouseDown={(e) => { e.preventDefault(); onLinkTodo(t.id); setTodoInput(''); }} className="block w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 transition">
                  {t.text}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => { onDelete(); onClose(); }}
            className="text-xs text-red-400 hover:text-red-600 transition"
          >
            Löschen
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!title.trim()}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition disabled:opacity-40"
          >
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
