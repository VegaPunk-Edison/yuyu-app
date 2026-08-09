// Fortschritts-"Strahl": horizontale Linie vom Start zum Ziel (rechtes Ende), mit einem Punkt
// pro Meilenstein und einem Marker für den aktuellen Stand (Anteil erledigter Meilensteine).
export default function GoalProgressRay({ milestones }) {
  const completedCount = milestones.filter(m => m.completed).length;
  const pct = (completedCount / milestones.length) * 100;

  return (
    <div className="my-3">
      <div className="relative h-1.5 bg-slate-100 rounded-full">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
        {milestones.map((m, i) => {
          const left = milestones.length === 1 ? 100 : (i / (milestones.length - 1)) * 100;
          return (
            <div
              key={m.id}
              title={m.name}
              className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border-2 ${
                m.completed ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'
              }`}
              style={{ left: `${left}%` }}
            />
          );
        })}
        <div
          title="Aktueller Stand"
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-amber-400 border-2 border-white shadow"
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-slate-400">Start</span>
        <span className="text-[10px] text-slate-600 font-medium">Ziel</span>
      </div>
    </div>
  );
}
