import { CheckCircle2, Circle } from 'lucide-react';

// Rein lesende, horizontale Anzeige der Meilensteine für die Ziel-Schnellübersicht -
// Hinzufügen/Umbenennen/Abhaken/Löschen geht nur noch über GoalDetailModal (GoalMilestones).
export default function GoalMilestonesSummary({ milestones }) {
  return (
    <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-1.5">
      {milestones.map(m => (
        <span
          key={m.id}
          className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full ${
            m.completed ? 'bg-slate-100 text-slate-400 line-through' : 'bg-amber-50 text-amber-700'
          }`}
        >
          {m.completed ? (
            <CheckCircle2 className="w-3 h-3" strokeWidth={1.5} />
          ) : (
            <Circle className="w-3 h-3" strokeWidth={1.5} />
          )}
          {m.name}
        </span>
      ))}
    </div>
  );
}
