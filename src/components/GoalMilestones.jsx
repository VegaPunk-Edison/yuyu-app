import { useState } from 'react';
import { Trash2, CheckCircle2, Circle } from 'lucide-react';
import GoalProgressRay from './GoalProgressRay.jsx';

// Meilensteine eines Ziels: werden nachträglich hinzugefügt, zeigen den Fortschritts-Strahl,
// eine Liste zum Abhaken/Löschen und ein Eingabefeld für neue Meilensteine.
export default function GoalMilestones({ goal, onAdd, onToggle, onDelete, onEdit }) {
  const [value, setValue] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const milestones = goal.milestones || [];

  const submit = () => {
    if (!value.trim()) return;
    onAdd(value);
    setValue('');
  };

  const startEdit = (m) => {
    setEditingId(m.id);
    setEditValue(m.name);
  };

  const saveEdit = () => {
    if (editValue.trim() && editValue.trim() !== milestones.find(m => m.id === editingId)?.name) {
      onEdit(editingId, editValue.trim());
    }
    setEditingId(null);
    setEditValue('');
  };

  return (
    <div className="mt-3 pt-3 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
      {milestones.length > 0 && <GoalProgressRay milestones={milestones} />}
      {milestones.length > 0 && (
        <div className="space-y-1 mb-2">
          {milestones.map(m => (
            <div key={m.id} className="flex items-center gap-2 group/milestone">
              <button onClick={() => onToggle(m.id)} className="flex-shrink-0">
                {m.completed ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" strokeWidth={1.5} />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-slate-300" strokeWidth={1.5} />
                )}
              </button>
              {editingId === m.id ? (
                <input
                  type="text"
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={saveEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); saveEdit(); }
                    if (e.key === 'Escape') { e.preventDefault(); setEditingId(null); setEditValue(''); }
                  }}
                  className="flex-1 min-w-0 text-xs font-light text-slate-900 bg-white border-b border-blue-400 outline-none"
                />
              ) : (
                <span
                  onClick={() => startEdit(m)}
                  className={`flex-1 text-xs font-light cursor-text ${m.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}
                >
                  {m.name}
                </span>
              )}
              <button
                onClick={() => onDelete(m.id)}
                className="p-1 -m-1 text-slate-300 hover:text-red-500 transition opacity-0 group-hover/milestone:opacity-100 flex-shrink-0"
              >
                <Trash2 className="w-3 h-3" strokeWidth={1.5} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
          placeholder="Meilenstein hinzufügen"
          className="flex-1 min-w-0 px-0 py-1 bg-white text-slate-900 border-b border-slate-200 placeholder-slate-400 focus:border-blue-500 outline-none font-light text-xs"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!value.trim()}
          className="flex-shrink-0 px-2 py-1 text-xs text-blue-600 hover:text-blue-700 disabled:text-slate-300 transition"
        >
          Hinzufügen
        </button>
      </div>
    </div>
  );
}
