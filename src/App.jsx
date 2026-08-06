import React, { useState, useEffect, useRef } from 'react';
import { Trash2, CheckCircle2, Circle, X, ArrowLeft, Heart, Pencil, ChevronDown, Clipboard } from 'lucide-react';
import { sb, setRememberMe } from './lib/supabase.js';

const MAX_HEARTS = 7;
const HEART_LOSS_PER_FAIL = 0.25;

// Level-Formel von PIFA übernommen (dort: computeAttrLevel/xpForLevel in Dashboard.js) - jedes
// Level braucht kumulativ mehr XP als das vorherige, Cap bei Level 10 ("MAX", wie in PIFA).
// Gilt einheitlich für alles, was in YuYu levelt: Lebensbereiche, Gewohnheiten, Fähigkeiten, Tugenden.
const XP_LEVEL_CAP = 10;
const xpForLevel = (level) => Math.round(100 * Math.pow(1.8, level));
const computeLevelFromXP = (totalXp) => {
  let level = 0;
  let rem = totalXp || 0;
  while (level < XP_LEVEL_CAP) {
    const needed = xpForLevel(level);
    if (rem < needed) break;
    rem -= needed;
    level += 1;
  }
  return { level, xpInLevel: rem, xpNeeded: level < XP_LEVEL_CAP ? xpForLevel(level) : null };
};

// Oberkategorien gelten für diese drei Typen - Items dieser Typen sind nur innerhalb einer
// offenen Oberkategorie sichtbar/anlegbar (wie bisher schon bei Tugenden).
const GROUPED_TYPES = ['principles', 'habits', 'skills'];
// Feste ids für die einmalig angelegten "Allgemein"-Default-Gruppen (siehe itemGroups-Initializer
// und migrateItemXP) - als String statt Date.now(), damit zwei unabhängige useState-Initializer
// dieselbe id referenzieren können, ohne sich zu koordinieren.
const DEFAULT_GROUP_ID = { habits: 'default-habits', skills: 'default-skills' };

// Migration: alte Felder (Tugenden: points; Lebensbereiche/Gewohnheiten/Fähigkeiten/Ziele:
// level+experience+maxExperience) in die neue kumulative xp-Struktur überführen. Rechnet den
// bisherigen Fortschritt näherungsweise um, statt ihn zu verwerfen (alt: 3 Punkte = 1 Level bei
// Tugenden bzw. fix 100 XP pro Level bei den anderen Typen - beides war linear, die neue Formel
// nicht mehr, daher nur eine Näherung auf Basis des bisher investierten Gesamtaufwands). Getrennt
// davon: Gewohnheiten/Fähigkeiten ohne groupId (gab es vor den Oberkategorien für diese Typen)
// bekommen die "Allgemein"-Default-Gruppe zugewiesen, unabhängig davon ob xp schon migriert war.
const migrateItemXP = (item) => {
  let result = item;
  if (result.xp === undefined) {
    if (result.type === 'principles') {
      const { points, ...rest } = result;
      result = { ...rest, xp: Math.round((points || 0) * (100 / 3)) };
    } else if (['life-areas', 'habits', 'skills', 'goals'].includes(result.type)) {
      const { level, experience, maxExperience: _maxExperience, ...rest } = result;
      result = { ...rest, xp: (level || 0) * 100 + (experience || 0) };
    }
  }
  if ((result.type === 'habits' || result.type === 'skills') && !result.groupId) {
    result = { ...result, groupId: DEFAULT_GROUP_ID[result.type] };
  }
  return result;
};

// Die vier Lebensbereiche sind fest vorgegeben, keine frei anlegbaren Einträge
const FIXED_LIFE_AREAS = ['Persönlich', 'Familie & Freunde', 'Arbeit', 'Gemeinde'];
const LIFE_AREA_XP_PER_COMPLETION = 10;
// Fähigkeiten und Tugenden laufen mit dem gleichen XP-Zuwachs pro Erledigung wie Lebensbereiche
const SKILL_XP_PER_COMPLETION = 10;
const VIRTUE_XP_PER_COMPLETION = 10;
// Pixeliges 8-Bit-Herz: Rastergröße füllen, indem pro Zelle die klassische Herz-Formel
// (x²+y²-1)³ - x²y³ <= 0 ausgewertet wird - ergibt automatisch die gestufte Pixel-Silhouette.
const PIXEL_HEART_COLS = 20;
const PIXEL_HEART_ROWS = 18;
const PIXEL_HEART_CELL = 10;
const buildPixelHeartGrid = (cols, rows) => {
  const xMin = -1.15, xMax = 1.15, yTop = 1.22, yBottom = -0.95;
  const grid = [];
  for (let row = 0; row < rows; row++) {
    const line = [];
    for (let col = 0; col < cols; col++) {
      const x = xMin + ((col + 0.5) / cols) * (xMax - xMin);
      const y = yTop - ((row + 0.5) / rows) * (yTop - yBottom);
      const value = Math.pow(x * x + y * y - 1, 3) - x * x * y * y * y;
      line.push(value <= 0 ? 1 : 0);
    }
    grid.push(line);
  }
  return grid;
};
const PIXEL_HEART_GRID = buildPixelHeartGrid(PIXEL_HEART_COLS, PIXEL_HEART_ROWS);
const PIXEL_HEART_COL_DIVIDER = Math.floor(PIXEL_HEART_COLS / 2);
const PIXEL_HEART_ROW_DIVIDER = Math.floor(PIXEL_HEART_ROWS / 2) - 1;
const PIXEL_HEART_QUADRANT_BOUNDS = {
  tl: { colStart: 0, colEnd: PIXEL_HEART_COL_DIVIDER - 1, rowStart: 0, rowEnd: PIXEL_HEART_ROW_DIVIDER - 1 },
  tr: { colStart: PIXEL_HEART_COL_DIVIDER + 1, colEnd: PIXEL_HEART_COLS - 1, rowStart: 0, rowEnd: PIXEL_HEART_ROW_DIVIDER - 1 },
  bl: { colStart: 0, colEnd: PIXEL_HEART_COL_DIVIDER - 1, rowStart: PIXEL_HEART_ROW_DIVIDER + 1, rowEnd: PIXEL_HEART_ROWS - 1 },
  br: { colStart: PIXEL_HEART_COL_DIVIDER + 1, colEnd: PIXEL_HEART_COLS - 1, rowStart: PIXEL_HEART_ROW_DIVIDER + 1, rowEnd: PIXEL_HEART_ROWS - 1 },
};
// Label-Anker je Viertel: die Zeile mit der größten gefüllten Breite innerhalb des Viertels
// verwenden (nicht die vertikale Mitte der rechteckigen Vierteljustierung) - untere Viertel
// laufen spitz zu, eine reine Mittelwert-Zentrierung würde z.B. "Gemeinde" abschneiden.
const computeFilledCenter = (bounds) => {
  let bestRow = bounds.rowStart, bestWidth = -1, bestMinCol = bounds.colStart, bestMaxCol = bounds.colEnd;
  for (let row = bounds.rowStart; row <= bounds.rowEnd; row++) {
    let minCol = Infinity, maxCol = -Infinity;
    for (let col = bounds.colStart; col <= bounds.colEnd; col++) {
      if (PIXEL_HEART_GRID[row][col]) {
        if (col < minCol) minCol = col;
        if (col > maxCol) maxCol = col;
      }
    }
    if (maxCol >= minCol && maxCol - minCol > bestWidth) {
      bestWidth = maxCol - minCol;
      bestRow = row;
      bestMinCol = minCol;
      bestMaxCol = maxCol;
    }
  }
  return {
    x: ((bestMinCol + bestMaxCol + 1) / 2) * PIXEL_HEART_CELL,
    y: (bestRow + 0.5) * PIXEL_HEART_CELL,
  };
};
const LIFE_AREA_QUADRANTS = [
  { name: 'Persönlich', lines: ['Persönlich'], quadrant: 'tl' },
  { name: 'Familie & Freunde', lines: ['Familie &', 'Freunde'], quadrant: 'tr' },
  { name: 'Arbeit', lines: ['Arbeit'], quadrant: 'bl' },
  { name: 'Gemeinde', lines: ['Gemeinde'], quadrant: 'br' },
].map(q => ({ ...q, ...computeFilledCenter(PIXEL_HEART_QUADRANT_BOUNDS[q.quadrant]) }));

const loadJSON = (key, fallback) => {
  try {
    const saved = localStorage.getItem(key);
    return saved !== null ? JSON.parse(saved) : fallback;
  } catch (err) {
    console.error(`Konnte "${key}" nicht laden:`, err);
    return fallback;
  }
};

const GOAL_TITLE_MAX_LENGTH = 60;

// Ziel anlegen: ein einziges Textfeld wandert per Enter durch die Stufen Lebensbereich (optional)
// -> Titel (Pflicht, zeichenbegrenzt) -> gewünschtes Ergebnis (Pflicht) -> Tugend(en, mehrfach
// möglich, optional). Jede Antwort wird oben als Zusammenfassung angezeigt; am Ende bestätigt
// ein "Speichern"-Klick oder leeres Enter auf der letzten Stufe das Ziel auf einmal.
function GoalForm({ virtues, skills, lifeAreas, virtueGroups, skillGroups, onCreateVirtue, onCreateSkill, onSubmit }) {
  const [stage, setStage] = useState('lifearea');
  const [value, setValue] = useState('');
  const [lifeArea, setLifeArea] = useState(null);
  const [learningGoal, setLearningGoal] = useState('');
  const [title, setTitle] = useState('');
  const [problem, setProblem] = useState('');
  const [description, setDescription] = useState('');
  const [linkedIds, setLinkedIds] = useState([]);
  const [linkedSkillIds, setLinkedSkillIds] = useState([]);
  const [pendingGroupItemName, setPendingGroupItemName] = useState('');
  const [creatingNewGroup, setCreatingNewGroup] = useState(false);
  const inputRef = useRef(null);

  // Fokus wandert mit, damit man ohne erneutes Antippen weiterschreiben kann - auch wenn sich
  // innerhalb der virtue-group/skill-group-Stufe zwischen Liste und "neue Oberkategorie"-Eingabe umschaltet.
  useEffect(() => {
    inputRef.current?.focus();
  }, [stage, creatingNewGroup]);

  // Zeigt Vorschläge als durchsuchbares Dropdown, sobald die Stufe aktiv ist - auch ohne
  // Texteingabe (zum Durchklicken), gefiltert sobald getippt wird.
  const lifeAreaSuggestions = stage === 'lifearea'
    ? lifeAreas.filter(a => a.name.toLowerCase().includes(value.toLowerCase())).slice(0, 5)
    : [];

  const virtueSuggestions = stage === 'virtue'
    ? virtues.filter(v => v.name.toLowerCase().includes(value.toLowerCase()) && !linkedIds.includes(v.id)).slice(0, 5)
    : [];

  const skillSuggestions = stage === 'skill'
    ? skills.filter(s => s.name.toLowerCase().includes(value.toLowerCase()) && !linkedSkillIds.includes(s.id)).slice(0, 5)
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

  // Oberkategorie für eine spontan angelegte Tugend/Fähigkeit festlegen - entweder eine vorhandene
  // per id (Klick aus der Liste) oder eine neue mit diesem Namen (aus dem "+ Neue Oberkategorie"-
  // Feld). Welcher Typ gemeint ist, ergibt sich aus der aktuellen Stufe (virtue-group/skill-group).
  const pickGroup = async (groupId, newGroupName) => {
    if (stage === 'virtue-group') {
      const newVirtue = groupId
        ? await onCreateVirtue(pendingGroupItemName, groupId, null)
        : await onCreateVirtue(pendingGroupItemName, null, newGroupName);
      if (newVirtue) addVirtue(newVirtue);
      setStage('virtue');
    } else {
      const newSkill = groupId
        ? await onCreateSkill(pendingGroupItemName, groupId, null)
        : await onCreateSkill(pendingGroupItemName, null, newGroupName);
      if (newSkill) addSkill(newSkill);
      setStage('skill');
    }
    setPendingGroupItemName('');
    setValue('');
    setCreatingNewGroup(false);
  };

  const reset = () => {
    setStage('lifearea');
    setValue('');
    setLifeArea(null);
    setLearningGoal('');
    setTitle('');
    setProblem('');
    setDescription('');
    setLinkedIds([]);
    setLinkedSkillIds([]);
    setPendingGroupItemName('');
    setCreatingNewGroup(false);
  };

  const save = async () => {
    if (!learningGoal.trim() || !title.trim() || !problem.trim() || !description.trim()) return;
    // Formular nur bei tatsächlichem Erfolg zurücksetzen - schlägt das Speichern fehl (z.B.
    // Supabase-Fehler), bleiben die eingegebenen Antworten erhalten statt kommentarlos zu verschwinden.
    const ok = await onSubmit({ lifeAreaId: lifeArea?.id || null, learningGoal, title, problem, description, linkedIds, linkedSkillIds });
    if (ok !== false) reset();
  };

  // Eine Stufe zurück - z.B. um eine Antwort zu korrigieren; die vorherige Eingabe landet
  // wieder editierbar im Feld, ihr bestätigter Wert wird dafür aus der Zusammenfassung entfernt.
  const goBack = () => {
    if (stage === 'learning') {
      setValue(lifeArea?.name || '');
      setLifeArea(null);
      setStage('lifearea');
      return;
    }
    if (stage === 'title') {
      setValue(learningGoal);
      setLearningGoal('');
      setStage('learning');
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
    if (stage === 'virtue-group' || stage === 'skill-group') {
      if (creatingNewGroup) {
        setCreatingNewGroup(false);
        setValue('');
        return;
      }
      setValue(pendingGroupItemName);
      setPendingGroupItemName('');
      setStage(stage === 'virtue-group' ? 'virtue' : 'skill');
      return;
    }
    if (stage === 'skill') {
      setValue('');
      setStage('virtue');
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
      setStage('learning');
      return;
    }

    if (stage === 'learning') {
      if (!value.trim()) return;
      setLearningGoal(value.trim());
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
      if (!value.trim()) return;
      setProblem(value.trim());
      setValue('');
      setStage('outcome');
      return;
    }

    if (stage === 'outcome') {
      if (!value.trim()) return;
      setDescription(value.trim());
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

    if (stage === 'virtue-group' || stage === 'skill-group') {
      // Nur die "+ Neue Oberkategorie"-Eingabe ist ein Textfeld - vorhandene werden per Klick
      // aus der Liste gewählt (pickGroup), nicht getippt.
      if (creatingNewGroup && value.trim()) pickGroup(null, value.trim());
      return;
    }

    // stage === 'skill' - leeres Enter darf nicht automatisch den ersten Dropdown-Eintrag
    // verknüpfen, sonst könnte man diese Stufe mit leerem Feld nie zum Speichern verlassen.
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
    save();
  };

  const placeholders = {
    lifearea: 'Welchem Lebensbereich zuordnen? (optional)',
    learning: 'Was muss ich lernen?',
    title: 'Was muss getan werden?',
    problem: 'Welches Problem löst du?',
    outcome: 'Was ist dein gewünschter Ausgang?',
    virtue: 'Tugend eingeben (mehrere möglich), Enter zum Bestätigen',
    'virtue-group': 'Name der neuen Oberkategorie',
    skill: 'Fähigkeit eingeben (mehrere möglich), Enter zum Bestätigen',
    'skill-group': 'Name der neuen Oberkategorie',
  };

  return (
    <div>
      {(lifeArea || learningGoal || title || problem || description) && (
        <div className="mb-2 space-y-0.5">
          {lifeArea && <p className="text-xs text-blue-600 font-light">{lifeArea.name}</p>}
          {learningGoal && <p className="text-xs text-slate-500 font-light">{learningGoal}</p>}
          {title && <p className="text-sm text-slate-900">{title}</p>}
          {problem && <p className="text-xs text-slate-500 font-light">{problem}</p>}
          {description && <p className="text-xs text-slate-500 font-light">{description}</p>}
        </div>
      )}
      {(linkedIds.length > 0 || linkedSkillIds.length > 0) && (
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
        </div>
      )}

      {stage === 'virtue-group' || stage === 'skill-group' ? (
        <div>
          <p className="text-xs text-slate-500 font-light mb-2">
            Neue {stage === 'virtue-group' ? 'Tugend' : 'Fähigkeit'} "{pendingGroupItemName}" - Oberkategorie wählen:
          </p>
          {!creatingNewGroup ? (
            <div className="space-y-1.5">
              {(stage === 'virtue-group' ? virtueGroups : skillGroups).map(g => (
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
          ) : stage === 'learning' || stage === 'problem' || stage === 'outcome' ? (
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
                  onMouseDown={(e) => { e.preventDefault(); setLifeArea(a); setValue(''); setStage('learning'); }}
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
        {stage === 'skill' && (
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

// Fortschritts-"Strahl": horizontale Linie vom Start zum Ziel (rechtes Ende), mit einem Punkt
// pro Meilenstein und einem Marker für den aktuellen Stand (Anteil erledigter Meilensteine).
function GoalProgressRay({ milestones }) {
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

// Meilensteine eines Ziels: werden nachträglich hinzugefügt, zeigen den Fortschritts-Strahl,
// eine Liste zum Abhaken/Löschen und ein Eingabefeld für neue Meilensteine.
function GoalMilestones({ goal, onAdd, onToggle, onDelete }) {
  const [value, setValue] = useState('');
  const milestones = goal.milestones || [];

  const submit = () => {
    if (!value.trim()) return;
    onAdd(value);
    setValue('');
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
              <span className={`flex-1 text-xs font-light ${m.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                {m.name}
              </span>
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
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
        placeholder="Meilenstein hinzufügen"
        className="w-full px-0 py-1 bg-white text-slate-900 border-b border-slate-200 placeholder-slate-400 focus:border-blue-500 outline-none font-light text-xs"
      />
    </div>
  );
}

// Aufgabe anlegen: ein einziges Textfeld wandert per Enter durch die Stufen
// Aufgabe -> Tugend(en, mehrfach möglich) -> Gewohnheit -> Lebensbereich.
// Leeres Enter überspringt die aktuelle (optionale) Stufe.
function TodoWizardInput({ virtues, skills, lifeAreas, onSubmit, placeholder, className, wrapperClassName }) {
  const [stage, setStage] = useState('task');
  const [value, setValue] = useState('');
  const [taskText, setTaskText] = useState('');
  const [linkedIds, setLinkedIds] = useState([]);
  const [linkedSkillIds, setLinkedSkillIds] = useState([]);
  const [habit, setHabit] = useState('');
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

  const reset = () => {
    setStage('task');
    setValue('');
    setTaskText('');
    setLinkedIds([]);
    setLinkedSkillIds([]);
    setHabit('');
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
      setValue(habit);
      setHabit('');
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
      setHabit(value.trim());
      setValue('');
      setStage('lifearea');
      return;
    }

    // stage === 'lifearea'
    const match = lifeAreaSuggestions.length > 0
      ? lifeAreaSuggestions[0]
      : lifeAreas.find(a => a.name.toLowerCase() === value.trim().toLowerCase());
    onSubmit({ text: taskText, linkedIds, linkedSkillIds, habit, lifeAreaId: match?.id || null });
    reset();
  };

  const placeholders = {
    task: placeholder || '+ Aufgabe hinzufügen',
    virtue: 'Tugend eingeben (mehrere möglich), Enter zum Bestätigen',
    skill: 'Fähigkeit eingeben (mehrere möglich), Enter zum Bestätigen',
    habit: 'Gewohnheit angeben (optional), Enter für weiter',
    lifearea: 'Lebensbereich angeben (optional), Enter zum Abschließen',
  };

  return (
    <div className={wrapperClassName}>
      {stage !== 'task' && (
        <p className="text-xs text-slate-400 font-light mb-1.5">
          Aufgabe: <span className="text-slate-600">{taskText}</span>
        </p>
      )}
      {(linkedIds.length > 0 || linkedSkillIds.length > 0) && (
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
        {stage === 'lifearea' && lifeAreaSuggestions.length > 0 && (
          <div className="absolute z-10 mt-1 min-w-[10rem] bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
            {lifeAreaSuggestions.map(a => (
              <button
                key={a.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSubmit({ text: taskText, linkedIds, linkedSkillIds, habit, lifeAreaId: a.id });
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

// ── Job + Arbeitgeber ────────────────────────────────────────────────────────
// Zwei-Stufen-Wizard wie GoalForm/TodoWizardInput: erst Job-Titel (Freitext), dann Arbeitgeber -
// aber als feste Liste von Buttons statt Freitext-Autocomplete, da der Arbeitgeber nur aus der
// kuratierten Supabase-Tabelle "employers" kommen darf.
function JobEmployerForm({ employers, initialJobTitle, initialEmployerId, onSubmit, onCancel }) {
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

// ── Login Screen ──────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    // Muss vor signInWithPassword gesetzt werden - der Storage-Adapter in lib/supabase.js liest
    // dieses Flag, sobald Supabase die neue Session direkt nach dem Login abspeichert.
    setRememberMe(remember);
    const { error: err } = await sb.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) setError(err.message);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '360px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '300', letterSpacing: '4px', textAlign: 'center', marginBottom: '8px', color: '#1e293b' }}>YuYu</h1>
        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', fontWeight: '300', marginBottom: '40px' }}>Melde dich mit deinen PIFA-Zugangsdaten an</p>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <input
            type="email"
            name="email"
            autoComplete="email"
            placeholder="E-Mail"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={{ padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '15px', outline: 'none', background: '#f8fafc', color: '#1e293b' }}
          />
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder="Passwort"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={{ padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '15px', outline: 'none', background: '#f8fafc', color: '#1e293b' }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={remember}
              onChange={e => setRemember(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: '#3b82f6' }}
            />
            Angemeldet bleiben
          </label>
          {error && <p style={{ color: '#ef4444', fontSize: '13px', textAlign: 'center' }}>{error}</p>}
          <button
            type="submit"
            disabled={loading}
            style={{ padding: '12px', borderRadius: '10px', background: '#3b82f6', color: '#fff', border: 'none', fontSize: '15px', fontWeight: '500', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Anmelden…' : 'Anmelden'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function YuYuApp() {
  const [session, setSession] = useState(undefined); // undefined = loading, null = not logged in
  const [section, setSection] = useState(() => loadJSON('yuyu-section', 'hub'));
  const [items, setItems] = useState(() => {
    const saved = loadJSON('yuyu-items', []).map(migrateItemXP);
    if (saved.some(i => i.type === 'life-areas')) return saved;
    // Die vier Lebensbereiche sind feste Einträge, keine vom User angelegten - einmalig seeden
    const seededLifeAreas = FIXED_LIFE_AREAS.map((name, i) => ({
      id: Date.now() + i,
      type: 'life-areas',
      name,
      xp: 0,
      createdAt: new Date().toISOString(),
    }));
    return [...saved, ...seededLifeAreas];
  });
  const [todos, setTodos] = useState(() => {
    const saved = loadJSON('yuyu-todos', null);
    if (saved !== null) return saved;
    // Migration: Aufgaben gab es früher pro Projekt - alle in eine flache Liste zusammenführen
    const legacyProjects = loadJSON('yuyu-projects', null);
    return legacyProjects ? legacyProjects.flatMap(p => p.todos || []) : [];
  });
  const [newItemName, setNewItemName] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [reorderMode, setReorderMode] = useState(false);
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [virtuesListExpanded, setVirtuesListExpanded] = useState(false);
  // Oberkategorien gelten für alle drei gruppierten Typen (Tugenden/Gewohnheiten/Fähigkeiten) -
  // ein gemeinsames Array mit `type`-Feld statt drei getrennter States, da immer nur eine Sektion
  // gleichzeitig sichtbar ist. Migration: alte Gruppen ohne `type` sind aus der Zeit, als es nur
  // Tugend-Oberkategorien gab. Für Gewohnheiten/Fähigkeiten ohne jede Gruppe (die es vor diesem
  // Update noch nicht gab) wird einmalig eine Default-Gruppe "Allgemein" angelegt und bestehende
  // ungruppierte Items hineingehängt, damit sie nach dem Update sichtbar bleiben.
  const [itemGroups, setItemGroups] = useState(() => {
    const saved = loadJSON('yuyu-virtue-groups', []).map(g => (g.type ? g : { ...g, type: 'principles' }));
    const savedItems = loadJSON('yuyu-items', []);
    const extraGroups = [];
    for (const type of ['habits', 'skills']) {
      const hasGroup = saved.some(g => g.type === type);
      const hasUngroupedItems = savedItems.some(i => i.type === type && !i.groupId);
      if (!hasGroup && hasUngroupedItems) {
        // Feste String-id statt Date.now(), damit der items-Initializer (separater useState-Aufruf,
        // siehe DEFAULT_GROUP_ID) unabhängig dieselbe id referenzieren kann, ohne beide Initializer
        // koordinieren zu müssen.
        extraGroups.push({ id: DEFAULT_GROUP_ID[type], name: 'Allgemein', type, createdAt: new Date().toISOString() });
      }
    }
    return [...saved, ...extraGroups];
  });
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [editingTodoId, setEditingTodoId] = useState(null);
  const [editingTodoText, setEditingTodoText] = useState('');
  const [hearts, setHearts] = useState(() => loadJSON('yuyu-hearts', MAX_HEARTS));
  const [heartLog, setHeartLog] = useState(() => loadJSON('yuyu-heart-log', []));
  const [penaltyTask, setPenaltyTask] = useState(() => loadJSON('yuyu-penalty-task', ''));
  const [showHeartLog, setShowHeartLog] = useState(false);
  const [editingPenaltyTask, setEditingPenaltyTask] = useState(false);
  const [penaltyTaskDraft, setPenaltyTaskDraft] = useState('');
  const [selectedLifeAreaId, setSelectedLifeAreaId] = useState(null);
  const [skillsTab, setSkillsTab] = useState('habits');
  const [employers, setEmployers] = useState([]);
  const [employerLink, setEmployerLink] = useState(null);
  const [editingEmployerLink, setEditingEmployerLink] = useState(false);
  const [employerLinkMessage, setEmployerLinkMessage] = useState('');
  const importFileInputRef = useRef(null);

  // Gewohnheiten & Fähigkeiten leben jetzt nur noch hinter dem YOU-Button (Dreieck-Auswahl,
  // zusammen mit Tugend) - deshalb hier nur noch 3 statt 4 Segmente im äußeren Rad.
  const categories = [
    { id: 'goals', label: 'Ziel', labelPlural: 'Ziele', startAngle: 0, endAngle: 120 },
    { id: 'life-areas', label: 'Lebensbereich', labelPlural: 'Lebensbereiche', startAngle: 120, endAngle: 240 },
    { id: 'todos', label: 'Aufgabe', labelPlural: 'Aufgaben', startAngle: 240, endAngle: 360 }
  ];

  const allCategories = [...categories, { id: 'principles', label: 'Tugend', labelPlural: 'Tugenden' }];
  const currentCategory = allCategories.find(c => c.id === section);
  // Gewohnheiten leben als eigener Tab unter Fähigkeiten - der gespeicherte Item-Typ folgt
  // dem aktiven Tab, nicht dem Abschnittsnamen "skills" selbst.
  const SKILLS_TABS = [
    { id: 'habits', label: 'Gewohnheit', labelPlural: 'Gewohnheiten' },
    { id: 'skills', label: 'Fähigkeit', labelPlural: 'Fähigkeiten' },
  ];
  const effectiveItemType = section === 'skills' ? skillsTab : section;
  const activeCategory = section === 'skills' ? SKILLS_TABS.find(t => t.id === skillsTab) : currentCategory;

  // ── Supabase Auth ──────────────────────────────────────────────────────────
  useEffect(() => {
    sb.auth.getSession().then(({ data: { session: s } }) => setSession(s ?? null));
    const { data: { subscription } } = sb.auth.onAuthStateChange((_, s) => setSession(s ?? null));
    return () => subscription.unsubscribe();
  }, []);

  // Beim Login: Ziele + Aufgaben aus Supabase laden und lokalen State ersetzen. Tugenden/
  // Gewohnheiten/Fähigkeiten (growth_items/growth_item_groups) sind die gemeinsame Datenbasis mit
  // PIFA - beim allerersten Login nach diesem Update werden bisher nur lokal gespeicherte Einträge
  // einmalig hochgeladen (Flag pro User, nicht "ist Remote leer?", damit ein Nutzer der serverseitig
  // bewusst alles gelöscht hat nicht bei jedem Login sein altes lokales Backup erneut hochlädt).
  useEffect(() => {
    if (!session) return;
    (async () => {
      const migrationFlagKey = `yuyu-growth-migrated-${session.user.id}`;
      if (localStorage.getItem(migrationFlagKey) !== 'true') {
        const localGroups = loadJSON('yuyu-virtue-groups', []).map(g => (g.type ? g : { ...g, type: 'principles' }));
        const localItems = loadJSON('yuyu-items', []).map(migrateItemXP).filter(i => GROUPED_TYPES.includes(i.type));
        if (localGroups.length === 0 && localItems.length === 0) {
          localStorage.setItem(migrationFlagKey, 'true');
        } else {
          // Nach (type, name) deduplizieren, sonst würde ein Bulk-Insert mit Duplikaten am
          // UNIQUE(user_id, type, name)-Constraint scheitern. upsert statt insert macht den ganzen
          // Block außerdem retry-sicher, falls ein vorheriger Versuch schon Gruppen angelegt hat.
          const uniqueGroups = [];
          const seen = new Set();
          for (const g of localGroups) {
            const key = `${g.type}::${g.name}`;
            if (!seen.has(key)) { seen.add(key); uniqueGroups.push(g); }
          }
          const { data: upsertedGroups, error: groupsError } = await sb.from('growth_item_groups').upsert(
            uniqueGroups.map(g => ({ user_id: session.user.id, type: g.type, name: g.name })),
            { onConflict: 'user_id,type,name' }
          ).select();
          if (groupsError) {
            console.error('Migration der Oberkategorien fehlgeschlagen, wird beim nächsten Login erneut versucht:', groupsError);
            window.alert('Deine lokal gespeicherten Tugenden/Gewohnheiten/Fähigkeiten konnten nicht mit deinem Account synchronisiert werden. Der Versuch wird beim nächsten Login wiederholt, bitte melde dich falls das öfter passiert.');
          } else {
            // Über (type, name) statt Array-Index zuordnen - PostgREST garantiert keine Reihenfolge.
            const groupIdMap = {};
            for (const local of localGroups) {
              const match = (upsertedGroups ?? []).find(row => row.type === local.type && row.name === local.name);
              if (match) groupIdMap[local.id] = match.id;
            }
            const itemsToInsert = localItems
              .filter(i => groupIdMap[i.groupId])
              .map((i, idx) => ({
                user_id: session.user.id, type: i.type, group_id: groupIdMap[i.groupId],
                name: i.name, xp: i.xp || 0, sort_order: idx,
              }));
            // Fehlende Zuordnung (groupIdMap-Miss) ODER ein fehlgeschlagener Insert dürfen NIE als
            // "erledigt" markiert werden - sonst geht genau der Rest der Daten unwiderruflich verloren,
            // ohne dass ein erneuter Versuch beim nächsten Login noch stattfindet (das ist vermutlich
            // exakt das, was hier zum Datenverlust geführt hat: der Insert-Fehler wurde nie geprüft).
            const unmatchedCount = localItems.length - itemsToInsert.length;
            let insertError = null;
            if (itemsToInsert.length > 0) {
              ({ error: insertError } = await sb.from('growth_items').insert(itemsToInsert));
            }
            if (insertError) {
              console.error('Migration der Items fehlgeschlagen, wird beim nächsten Login erneut versucht:', insertError);
              window.alert('Deine lokal gespeicherten Tugenden/Gewohnheiten/Fähigkeiten konnten nicht mit deinem Account synchronisiert werden. Der Versuch wird beim nächsten Login wiederholt, bitte melde dich falls das öfter passiert.');
            } else {
              if (unmatchedCount > 0) {
                console.error(`Migration: ${unmatchedCount} Item(s) konnten keiner migrierten Oberkategorie zugeordnet werden und wurden übersprungen.`);
              }
              localStorage.setItem(migrationFlagKey, 'true');
            }
          }
        }
      }

      const [goalsRes, msRes, todosRes, employersRes, employerLinkRes, growthItemsRes, growthGroupsRes] = await Promise.all([
        sb.from('yuyu_goals').select('*').eq('user_id', session.user.id).order('created_at'),
        sb.from('yuyu_goal_milestones').select('*').eq('user_id', session.user.id).order('created_at'),
        sb.from('yuyu_todos').select('*').eq('user_id', session.user.id).order('created_at'),
        sb.from('employers').select('*'),
        sb.from('user_employer_links').select('*').eq('user_id', session.user.id).maybeSingle(),
        sb.from('growth_items').select('*').eq('user_id', session.user.id).order('sort_order'),
        sb.from('growth_item_groups').select('*').eq('user_id', session.user.id).order('created_at'),
      ]);
      setEmployers(employersRes.data ?? []);
      setEmployerLink(employerLinkRes.data ?? null);

      // Fehlgeschlagene Fetches dürfen NIE den vorhandenen State (und damit über den saveData-Effekt
      // auch das localStorage-Backup) mit einem leeren Array überschreiben - sonst löscht ein einzelner
      // transienter Netzwerkfehler beim Login lokale wie servergespeicherte Daten aus der Anzeige, auch
      // wenn in Supabase weiterhin alles vorhanden ist. Bei einem Fehler bleibt der jeweilige Teil des
      // States unangetastet, statt mit `?? []` stillschweigend geleert zu werden.
      const goalsOk = !goalsRes.error && !msRes.error;
      const growthOk = !growthItemsRes.error && !growthGroupsRes.error;
      const todosOk = !todosRes.error;
      if (!goalsOk) console.error('Ziele konnten nicht geladen werden, lokaler Stand bleibt erhalten:', goalsRes.error || msRes.error);
      if (!growthOk) console.error('Tugenden/Gewohnheiten/Fähigkeiten konnten nicht geladen werden, lokaler Stand bleibt erhalten:', growthItemsRes.error || growthGroupsRes.error);
      if (!todosOk) console.error('Aufgaben konnten nicht geladen werden, lokaler Stand bleibt erhalten:', todosRes.error);

      if (growthOk) setItemGroups(growthGroupsRes.data ?? []);
      const remoteGrowthItems = growthOk ? (growthItemsRes.data ?? []).map(i => ({
        id: i.id, type: i.type, name: i.name, xp: i.xp, groupId: i.group_id, createdAt: i.created_at,
      })) : [];
      // Group milestones by goal_id
      const msMap = {};
      for (const m of (msRes.data ?? [])) {
        if (!msMap[m.goal_id]) msMap[m.goal_id] = [];
        msMap[m.goal_id].push(m);
      }
      // Convert Supabase goals → yuyu item format
      const remoteGoals = goalsOk ? (goalsRes.data ?? []).map(g => ({
        id: g.id,
        type: 'goals',
        name: g.title,
        title: g.title,
        description: g.description || '',
        learningGoal: g.learning_goal || '',
        problem: g.problem || '',
        life_area: g.life_area || '',
        lifeAreaId: null,
        linkedItems: [],
        linkedSkillIds: [],
        milestones: (msMap[g.id] ?? []).map(m => ({ id: m.id, name: m.name, completed: m.completed })),
        xp: 0,
        completed: g.status === 'achieved',
        failed: g.status === 'cancelled',
        createdAt: g.created_at,
      })) : [];
      // Replace local goals + growth-items (Tugenden/Gewohnheiten/Fähigkeiten) mit den Supabase-
      // Versionen, Lebensbereiche (rein lokal, kein PIFA-Äquivalent) bleiben unangetastet. Nur der
      // Teil wird ersetzt, dessen Fetch auch tatsächlich erfolgreich war (siehe goalsOk/growthOk oben).
      setItems(prev => {
        let next = prev;
        if (goalsOk) next = next.filter(i => i.type !== 'goals');
        if (growthOk) next = next.filter(i => !GROUPED_TYPES.includes(i.type));
        return [...next, ...remoteGoals, ...remoteGrowthItems];
      });
      // Convert Supabase todos → yuyu todo format
      if (todosOk) {
        const remoteTodos = (todosRes.data ?? []).map(t => ({
          id: t.id,
          text: t.text,
          completed: t.completed,
          failed: t.failed,
          linkedItems: [],
          linkedSkillIds: [],
          habit: t.habit || '',
          lifeAreaId: null,
          life_area: t.life_area || '',
          createdAt: t.created_at,
        }));
        setTodos(remoteTodos);
      }
    })();
  }, [session?.user?.id]);

  // Nur noch Speichern läuft über einen Effekt; Laden passiert synchron in den useState-Initializern
  // oben (siehe loadJSON) - sonst gäbe es einen Wettlauf: dieser Effekt liefe beim ersten Mount mit
  // den alten (leeren) State-Werten, bevor ein separater Lade-Effekt seine setState-Aufrufe verarbeitet
  // hätte, und würde die gerade geladenen/migrierten Daten wieder mit leeren Arrays überschreiben.
  useEffect(() => {
    saveData();
  }, [items, todos, itemGroups, hearts, heartLog, penaltyTask, section]);

  // Bei 0 Herzen ist nur noch der Aufgaben-Bereich zugänglich (Strafaufgabe muss zuerst erledigt werden)
  useEffect(() => {
    if (hearts <= 0 && ['principles', 'goals', 'life-areas', 'skills'].includes(section)) {
      setSection('todos');
    }
  }, [hearts, section]);

  const saveData = () => {
    localStorage.setItem('yuyu-items', JSON.stringify(items));
    localStorage.setItem('yuyu-todos', JSON.stringify(todos));
    localStorage.setItem('yuyu-virtue-groups', JSON.stringify(itemGroups));
    localStorage.setItem('yuyu-hearts', JSON.stringify(hearts));
    localStorage.setItem('yuyu-heart-log', JSON.stringify(heartLog));
    localStorage.setItem('yuyu-penalty-task', JSON.stringify(penaltyTask));
    localStorage.setItem('yuyu-section', JSON.stringify(section));
  };

  // Backup: alle Daten als JSON-Datei herunterladen, da nichts außerhalb dieses Browsers gespeichert wird
  const exportData = () => {
    const data = { items, todos, virtueGroups: itemGroups, hearts, heartLog, penaltyTask, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yuyu-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!window.confirm('Vorhandene Daten mit dieser Datei überschreiben?')) return;
        if (Array.isArray(data.items)) setItems(data.items.map(migrateItemXP));
        if (Array.isArray(data.todos)) setTodos(data.todos);
        if (Array.isArray(data.virtueGroups)) setItemGroups(data.virtueGroups.map(g => (g.type ? g : { ...g, type: 'principles' })));
        if (typeof data.hearts === 'number') setHearts(data.hearts);
        if (Array.isArray(data.heartLog)) setHeartLog(data.heartLog);
        if (typeof data.penaltyTask === 'string') setPenaltyTask(data.penaltyTask);
      } catch (err) {
        window.alert('Datei konnte nicht gelesen werden - ist es eine gültige YuYu-Backup-Datei?');
      }
    };
    reader.readAsText(file);
  };

  // Gemeinsame Schreib-Helfer für growth_items/growth_item_groups - die geteilte Datenbasis mit
  // PIFA für Tugenden/Gewohnheiten/Fähigkeiten. Genutzt von addItem, addGroup, createAndLinkVirtue
  // und createAndLinkSkill, die alle dieselbe Insert-Logik brauchen.
  const insertGroupRemote = async (type, name) => {
    const { data, error } = await sb.from('growth_item_groups').insert({
      user_id: session.user.id, type, name: name.trim(),
    }).select().single();
    if (error) {
      window.alert(`Oberkategorie konnte nicht gespeichert werden: ${error.message}`);
      return null;
    }
    return data && { id: data.id, name: data.name, type: data.type, createdAt: data.created_at };
  };

  const insertItemRemote = async (type, groupId, name) => {
    const { data, error } = await sb.from('growth_items').insert({
      user_id: session.user.id, type, group_id: groupId, name: name.trim(), xp: 0,
    }).select().single();
    if (error) {
      window.alert(`Konnte nicht gespeichert werden: ${error.message}`);
      return null;
    }
    return data && { id: data.id, type: data.type, name: data.name, xp: data.xp, groupId: data.group_id, createdAt: data.created_at };
  };

  const addItem = async (name, linkedVirtues = [], extra = {}) => {
    if (!name || !name.trim()) return;
    if (GROUPED_TYPES.includes(effectiveItemType) && !selectedGroupId) return;

    if (section === 'goals' && session) {
      const lifeAreaName = extra.lifeAreaId
        ? allLifeAreaItems.find(a => a.id === extra.lifeAreaId)?.name || null
        : null;
      const { data, error } = await sb.from('yuyu_goals').insert({
        user_id: session.user.id,
        title: name.trim(),
        description: (extra.description || '').trim() || null,
        learning_goal: (extra.learningGoal || '').trim() || null,
        problem: (extra.problem || '').trim() || null,
        life_area: lifeAreaName,
        status: 'open',
      }).select().single();
      if (error) {
        window.alert(`Ziel konnte nicht gespeichert werden: ${error.message}`);
        return false;
      }
      if (data) {
        setItems(prev => [...prev, {
          id: data.id,
          type: 'goals',
          name: data.title,
          title: data.title,
          description: data.description || '',
          learningGoal: data.learning_goal || '',
          problem: data.problem || '',
          life_area: data.life_area || '',
          lifeAreaId: extra.lifeAreaId || null,
          linkedItems: linkedVirtues,
          linkedSkillIds: extra.linkedSkillIds || [],
          milestones: [],
          xp: 0,
          completed: false, failed: false,
          createdAt: data.created_at,
        }]);
      }
      return true;
    }

    if (GROUPED_TYPES.includes(effectiveItemType) && session) {
      const newItem = await insertItemRemote(effectiveItemType, selectedGroupId, name);
      if (!newItem) return false;
      setItems(prev => [...prev, newItem]);
      return true;
    }

    const newItem = {
      id: Date.now(),
      type: effectiveItemType,
      name: name.trim(),
      xp: 0,
      createdAt: new Date().toISOString(),
    };
    if (GROUPED_TYPES.includes(effectiveItemType)) {
      newItem.groupId = selectedGroupId;
    } else if (section === 'goals') {
      newItem.linkedItems = linkedVirtues;
      newItem.linkedSkillIds = extra.linkedSkillIds || [];
      newItem.lifeAreaId = extra.lifeAreaId || null;
      newItem.description = (extra.description || '').trim();
      newItem.learningGoal = (extra.learningGoal || '').trim();
      newItem.problem = (extra.problem || '').trim();
      newItem.milestones = [];
    }
    setItems([...items, newItem]);
    return true;
  };

  // Meilensteine werden nachträglich zu einem bestehenden Ziel hinzugefügt
  const addMilestone = async (goalId, name) => {
    if (!name || !name.trim()) return;
    if (session) {
      const { data } = await sb.from('yuyu_goal_milestones').insert({
        goal_id: goalId, user_id: session.user.id, name: name.trim(),
      }).select().single();
      if (data) {
        setItems(prev => prev.map(i => i.id === goalId
          ? { ...i, milestones: [...(i.milestones || []), { id: data.id, name: data.name, completed: false }] }
          : i
        ));
      }
      return;
    }
    setItems(items.map(i => (i.id === goalId
      ? { ...i, milestones: [...(i.milestones || []), { id: Date.now(), name: name.trim(), completed: false }] }
      : i
    )));
  };

  const toggleMilestone = async (goalId, milestoneId) => {
    const goal = items.find(i => i.id === goalId);
    const ms = (goal?.milestones || []).find(m => m.id === milestoneId);
    if (!ms) return;
    if (session) {
      await sb.from('yuyu_goal_milestones').update({ completed: !ms.completed }).eq('id', milestoneId);
    }
    setItems(items.map(i => (i.id === goalId
      ? { ...i, milestones: (i.milestones || []).map(m => (m.id === milestoneId ? { ...m, completed: !m.completed } : m)) }
      : i
    )));
  };

  const deleteMilestone = async (goalId, milestoneId) => {
    if (session) {
      await sb.from('yuyu_goal_milestones').delete().eq('id', milestoneId);
    }
    setItems(items.map(i => (i.id === goalId
      ? { ...i, milestones: (i.milestones || []).filter(m => m.id !== milestoneId) }
      : i
    )));
  };

  // Oberkategorien (z.B. "Old Money" bei Tugenden) gruppieren die Items eines der drei
  // GROUPED_TYPES. Ein gemeinsames CRUD-Set für alle drei statt dreifacher Duplikation.
  const addGroup = async (type) => {
    if (!newGroupName.trim()) return;
    if (session) {
      const newGroup = await insertGroupRemote(type, newGroupName);
      if (newGroup) setItemGroups(prev => [...prev, newGroup]);
      setNewGroupName('');
      return;
    }
    setItemGroups(prev => [...prev, {
      id: Date.now(),
      name: newGroupName,
      type,
      createdAt: new Date().toISOString(),
    }]);
    setNewGroupName('');
  };

  const renameGroup = async (id, newName) => {
    if (!newName.trim()) return;
    if (session) {
      await sb.from('growth_item_groups').update({ name: newName.trim() }).eq('id', id);
    }
    setItemGroups(prev => prev.map(g => (g.id === id ? { ...g, name: newName } : g)));
  };

  // Spontanes Anlegen einer Tugend aus dem Ziel-Formular heraus (@Mention-artig): Tugenden
  // brauchen zwingend eine Oberkategorie, daher entweder eine vorhandene per id verwenden oder
  // per newGroupName eine neue anlegen - genau eins von beiden muss gesetzt sein.
  const createAndLinkVirtue = async (name, groupId, newGroupName) => {
    if (!name.trim()) return null;
    let targetGroupId = groupId;
    if (!targetGroupId && newGroupName?.trim()) {
      if (session) {
        const newGroup = await insertGroupRemote('principles', newGroupName);
        if (!newGroup) return null;
        setItemGroups(prev => [...prev, newGroup]);
        targetGroupId = newGroup.id;
      } else {
        const newGroup = { id: Date.now(), name: newGroupName.trim(), type: 'principles', createdAt: new Date().toISOString() };
        setItemGroups(prev => [...prev, newGroup]);
        targetGroupId = newGroup.id;
      }
    }
    if (!targetGroupId) return null;
    if (session) {
      const newVirtue = await insertItemRemote('principles', targetGroupId, name);
      if (newVirtue) setItems(prev => [...prev, newVirtue]);
      return newVirtue;
    }
    const newVirtue = { id: Date.now() + 1, type: 'principles', name: name.trim(), xp: 0, groupId: targetGroupId, createdAt: new Date().toISOString() };
    setItems(prev => [...prev, newVirtue]);
    return newVirtue;
  };

  // Spontanes Anlegen einer Fähigkeit aus dem Ziel-Formular heraus - braucht wie Tugenden
  // zwingend eine Oberkategorie (siehe GROUPED_TYPES).
  const createAndLinkSkill = async (name, groupId, newGroupName) => {
    if (!name.trim()) return null;
    let targetGroupId = groupId;
    if (!targetGroupId && newGroupName?.trim()) {
      if (session) {
        const newGroup = await insertGroupRemote('skills', newGroupName);
        if (!newGroup) return null;
        setItemGroups(prev => [...prev, newGroup]);
        targetGroupId = newGroup.id;
      } else {
        const newGroup = { id: Date.now(), name: newGroupName.trim(), type: 'skills', createdAt: new Date().toISOString() };
        setItemGroups(prev => [...prev, newGroup]);
        targetGroupId = newGroup.id;
      }
    }
    if (!targetGroupId) return null;
    if (session) {
      const newSkill = await insertItemRemote('skills', targetGroupId, name);
      if (newSkill) setItems(prev => [...prev, newSkill]);
      return newSkill;
    }
    const newSkill = { id: Date.now() + 1, type: 'skills', name: name.trim(), xp: 0, groupId: targetGroupId, createdAt: new Date().toISOString() };
    setItems(prev => [...prev, newSkill]);
    return newSkill;
  };

  const deleteGroup = async (id, type, label, labelPlural) => {
    const group = itemGroups.find(g => g.id === id);
    const groupItemCount = items.filter(i => i.type === type && i.groupId === id).length;
    const warning = groupItemCount > 0
      ? `"${group?.name}" und die ${groupItemCount} enthaltene${groupItemCount === 1 ? '' : 'n'} ${groupItemCount === 1 ? label : labelPlural} werden unwiderruflich gelöscht. Fortfahren?`
      : `"${group?.name}" löschen?`;
    if (!window.confirm(warning)) return;
    if (session) {
      // ON DELETE CASCADE auf growth_items.group_id räumt die enthaltenen Items serverseitig mit auf.
      await sb.from('growth_item_groups').delete().eq('id', id);
    }
    setItemGroups(prev => prev.filter(g => g.id !== id));
    setItems(prev => prev.filter(i => !(i.type === type && i.groupId === id)));
    if (selectedGroupId === id) setSelectedGroupId(null);
    if (editingGroupId === id) setEditingGroupId(null);
  };

  // Merkt sich nur die letzten 3 Herz-Aktionen (Gewinn/Verlust) für die Anzeige an der Herzleiste
  const logHeartEvent = (type, label) => {
    setHeartLog(prev => [{ id: Date.now(), type, label, at: new Date().toISOString() }, ...prev].slice(0, 3));
  };

  const loseHeart = (label) => {
    setHearts(prev => Math.max(0, Math.round((prev - HEART_LOSS_PER_FAIL) * 100) / 100));
    logHeartEvent('loss', label);
  };

  const gainHeart = (label) => {
    setHearts(prev => Math.min(MAX_HEARTS, Math.round((prev + HEART_LOSS_PER_FAIL) * 100) / 100));
    logHeartEvent('gain', label);
  };

  const addTodo = async (text, linkedVirtues = [], extra = {}) => {
    if (!text || !text.trim()) return;
    const lifeAreaName = extra.lifeAreaId
      ? allLifeAreaItems.find(a => a.id === extra.lifeAreaId)?.name || null
      : null;
    if (session) {
      const { data } = await sb.from('yuyu_todos').insert({
        user_id: session.user.id,
        text: text.trim(),
        life_area: lifeAreaName,
        habit: (extra.habit || '').trim() || null,
      }).select().single();
      if (data) {
        setTodos(prev => [...prev, {
          id: data.id,
          text: data.text,
          completed: false, failed: false,
          linkedItems: linkedVirtues,
          linkedSkillIds: extra.linkedSkillIds || [],
          habit: data.habit || '',
          lifeAreaId: extra.lifeAreaId || null,
          life_area: data.life_area || '',
          createdAt: data.created_at,
        }]);
      }
      return;
    }
    setTodos([...todos, {
      id: Date.now(),
      text: text.trim(),
      completed: false, failed: false,
      linkedItems: linkedVirtues,
      linkedSkillIds: extra.linkedSkillIds || [],
      habit: (extra.habit || '').trim(),
      lifeAreaId: extra.lifeAreaId || null,
      createdAt: new Date().toISOString(),
    }]);
  };

  // Erledigte Aufgabe gibt ein Viertel-Herz zurück (bis maximal MAX_HEARTS)
  const toggleTodo = async (todoId) => {
    const todo = todos.find(t => t.id === todoId);
    if (!todo || todo.completed) return;
    if (session) {
      await sb.from('yuyu_todos').update({ completed: true, updated_at: new Date().toISOString() }).eq('id', todoId);
    }
    setTodos(todos.map(t => (t.id === todoId ? { ...t, completed: true } : t)));
    gainVirtueXP(todo.linkedItems || []);
    gainHeart(`Aufgabe erledigt: "${todo.text}"`);
    gainLifeAreaXP(todo.lifeAreaId);
    gainSkillXP(todo.linkedSkillIds || []);
  };

  // Aufgabe als gescheitert markieren: kostet ein Viertel-Herz
  const failTodo = async (todoId) => {
    const todo = todos.find(t => t.id === todoId);
    if (!todo || todo.completed || todo.failed) return;
    if (session) {
      await sb.from('yuyu_todos').update({ failed: true, updated_at: new Date().toISOString() }).eq('id', todoId);
    }
    setTodos(todos.map(t => (t.id === todoId ? { ...t, failed: true } : t)));
    loseHeart(`Aufgabe gescheitert: "${todo.text}"`);
  };

  // Tugenden sammeln XP durch verknüpfte Ziele/Aufgaben - gleiche Formel wie alle anderen Typen.
  // Nutzt eine funktionale Aktualisierung, da sie oft direkt nach einem anderen setItems-Aufruf
  // im selben Handler läuft (z.B. in completeItem) - sonst würde der zweite Aufruf mit einem
  // veralteten items-Snapshot den ersten überschreiben.
  const gainVirtueXP = (virtueIds) => {
    if (virtueIds.length === 0) return;
    setItems(prev => prev.map(item =>
      virtueIds.includes(item.id) ? { ...item, xp: (item.xp || 0) + VIRTUE_XP_PER_COMPLETION } : item
    ));
    if (session) {
      items.filter(i => virtueIds.includes(i.id)).forEach(i => {
        sb.from('growth_items').update({ xp: (i.xp || 0) + VIRTUE_XP_PER_COMPLETION }).eq('id', i.id);
      });
    }
  };

  // Lebensbereich sammelt XP durch Beteiligung an Zielen/Aufgaben; Level wird aus der kumulierten
  // xp per computeLevelFromXP abgeleitet, nicht mehr separat mitgeführt.
  const gainLifeAreaXP = (lifeAreaId) => {
    if (!lifeAreaId) return;
    setItems(prev => prev.map(i => (i.id === lifeAreaId ? { ...i, xp: (i.xp || 0) + LIFE_AREA_XP_PER_COMPLETION } : i)));
  };

  // Job + Arbeitgeber für den Lebensbereich "Arbeit": Arbeitgeber kommt aus der kuratierten
  // Supabase-Tabelle "employers", nicht aus Freitext. Ein neu gewählter Arbeitgeber startet
  // immer unverknüpft (linked: false) - die Verknüpfung muss über confirmEmployerLink bestätigt werden.
  const upsertEmployerLink = async (jobTitle, employerId) => {
    if (!session) return;
    const { data } = await sb.from('user_employer_links').upsert({
      user_id: session.user.id,
      job_title: jobTitle.trim(),
      employer_id: employerId || null,
      linked: false,
    }).select().single();
    if (data) setEmployerLink(data);
    setEmployerLinkMessage('');
  };

  // Prüft über den bestehenden PIFA-Profil-Endpoint, ob für diesen Nutzer (gleicher Supabase-Auth-
  // Account) bereits ein vollständiges Profil existiert - dessen Vorhandensein IST die Verknüpfung.
  const confirmEmployerLink = async () => {
    const employer = employers.find(e => e.id === employerLink?.employer_id);
    if (!employer?.linkable) return;
    setEmployerLinkMessage('Prüfe Verknüpfung…');
    try {
      const { data: profile } = await sb.from('profiles').select('name').eq('id', session.user.id).maybeSingle();
      if (profile?.name) {
        await sb.from('user_employer_links').update({ linked: true }).eq('user_id', session.user.id);
        setEmployerLink(prev => ({ ...prev, linked: true }));
        setEmployerLinkMessage('');
      } else {
        setEmployerLinkMessage(`Noch kein ${employer.name}-Konto gefunden – bitte zuerst dort registrieren.`);
      }
    } catch {
      setEmployerLinkMessage('Verknüpfung konnte nicht geprüft werden – versuch es später erneut.');
    }
  };

  // Fähigkeiten sammeln XP durch verknüpfte Ziele/Aufgaben - gleiches Level-System wie Lebensbereiche
  const gainSkillXP = (skillIds) => {
    if (!skillIds || skillIds.length === 0) return;
    setItems(prev => prev.map(i => (skillIds.includes(i.id) ? { ...i, xp: (i.xp || 0) + SKILL_XP_PER_COMPLETION } : i)));
    if (session) {
      items.filter(i => skillIds.includes(i.id)).forEach(i => {
        sb.from('growth_items').update({ xp: (i.xp || 0) + SKILL_XP_PER_COMPLETION }).eq('id', i.id);
      });
    }
  };

  const deleteItem = async (id) => {
    const item = items.find(i => i.id === id);
    if (item?.type === 'goals' && session) {
      await sb.from('yuyu_goals').delete().eq('id', id);
    } else if (item && GROUPED_TYPES.includes(item.type) && session) {
      await sb.from('growth_items').delete().eq('id', id);
    }
    setItems(items.filter(i => i.id !== id));
  };

  // Ziel als gescheitert markieren: kostet ein Viertel-Herz
  const failItem = async (id) => {
    const item = items.find(i => i.id === id);
    if (!item || item.failed || item.completed) return;
    if (item.type === 'goals' && session) {
      await sb.from('yuyu_goals').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', id);
    }
    setItems(items.map(i => (i.id === id ? { ...i, failed: true } : i)));
    loseHeart(`Ziel gescheitert: "${item.name}"`);
  };

  // Ziel als erfolgreich abgeschlossen markieren: vergibt XP an verknüpfte Tugenden
  const completeItem = async (id) => {
    const item = items.find(i => i.id === id);
    if (!item || item.failed || item.completed) return;
    if (item.type === 'goals' && session) {
      await sb.from('yuyu_goals').update({ status: 'achieved', updated_at: new Date().toISOString() }).eq('id', id);
    }
    setItems(prev => prev.map(i => (i.id === id ? { ...i, completed: true } : i)));
    gainVirtueXP(item.linkedItems || []);
    gainLifeAreaXP(item.lifeAreaId);
    gainSkillXP(item.linkedSkillIds || []);
  };

  const toggleSelectItem = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const deleteSelectedItems = async () => {
    if (GROUPED_TYPES.includes(effectiveItemType) && session) {
      await sb.from('growth_items').delete().in('id', selectedIds);
    }
    setItems(items.filter(i => !selectedIds.includes(i.id)));
    setSelectedIds([]);
    setSelectionMode(false);
  };

  // Welche Items gerade sichtbar/sortierbar sind: bei gruppierten Typen zusätzlich nach Oberkategorie gefiltert
  const itemInScope = (i) => {
    if (!GROUPED_TYPES.includes(effectiveItemType)) return i.type === effectiveItemType;
    return i.type === effectiveItemType && (selectedGroupId ? i.groupId === selectedGroupId : !i.groupId);
  };

  // Tugend per Drag & Drop an neue Position im Ranking der Kategorie verschieben. sort_order wird
  // bei angemeldeten Nutzern serverseitig mitgeschrieben, damit die Reihenfolge auch für PIFA gilt.
  const reorderItems = (draggedItemId, targetItemId) => {
    if (draggedItemId === targetItemId) return;
    setItems(prev => {
      const sameType = prev.filter(itemInScope);
      const otherType = prev.filter(i => !itemInScope(i));
      const fromIdx = sameType.findIndex(i => i.id === draggedItemId);
      const toIdx = sameType.findIndex(i => i.id === targetItemId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const reordered = [...sameType];
      const [moved] = reordered.splice(fromIdx, 1);
      reordered.splice(toIdx, 0, moved);
      if (GROUPED_TYPES.includes(effectiveItemType) && session) {
        reordered.forEach((item, idx) => {
          sb.from('growth_items').update({ sort_order: idx }).eq('id', item.id);
        });
      }
      return [...otherType, ...reordered];
    });
  };

  // Ziehen per Maus oder Finger: funktioniert einheitlich über die Pointer-Events-API
  const handleDragHandlePointerDown = (e, id) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraggedId(id);
  };

  const handleDragHandlePointerMove = (e) => {
    if (draggedId == null) return;
    const target = document.elementFromPoint(e.clientX, e.clientY);
    const row = target?.closest('[data-item-id]');
    setDragOverId(row ? Number(row.dataset.itemId) : null);
  };

  const handleDragHandlePointerUp = () => {
    if (draggedId != null && dragOverId != null && dragOverId !== draggedId) {
      reorderItems(draggedId, dragOverId);
    }
    setDraggedId(null);
    setDragOverId(null);
  };

  // Tugend/Item innerhalb seiner Kategorie nach links/rechts verschieben
  const moveItem = (id, direction) => {
    setItems(prev => {
      const sameType = prev.filter(itemInScope);
      const otherType = prev.filter(i => !itemInScope(i));
      const idx = sameType.findIndex(i => i.id === id);
      if (idx === -1) return prev;
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= sameType.length) return prev;
      const reordered = [...sameType];
      [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
      if (GROUPED_TYPES.includes(effectiveItemType) && session) {
        reordered.forEach((item, idx2) => {
          sb.from('growth_items').update({ sort_order: idx2 }).eq('id', item.id);
        });
      }
      return [...otherType, ...reordered];
    });
  };

  const deleteTodo = async (todoId) => {
    if (session) {
      await sb.from('yuyu_todos').delete().eq('id', todoId);
    }
    setTodos(todos.filter(t => t.id !== todoId));
  };

  const editTodo = async (todoId, newText) => {
    if (!newText || !newText.trim()) return;
    if (session) {
      await sb.from('yuyu_todos').update({ text: newText.trim(), updated_at: new Date().toISOString() }).eq('id', todoId);
    }
    setTodos(prev => prev.map(t => (t.id === todoId ? { ...t, text: newText.trim() } : t)));
  };

  const sectionItems = items.filter(itemInScope);
  const allVirtueItems = items.filter(i => i.type === 'principles');
  const allLifeAreaItems = items.filter(i => i.type === 'life-areas');
  const allSkillItems = items.filter(i => i.type === 'skills');

  // Text in mehrere Zeilen umbrechen, damit er ins Puzzleteil passt
  const wrapPuzzleText = (name, maxCharsPerLine = 11) => {
    const words = name.split(' ');
    const lines = [];
    let current = '';
    words.forEach(word => {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length <= maxCharsPerLine) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    });
    if (current) lines.push(current);
    return lines.slice(0, 2);
  };

  // Puzzle-Piece Pfad mit Verbindungen auf allen 4 Seiten (echtes Jigsaw-Puzzle)
  const puzzlePieceGridPath = (w, h, edges) => {
    const r = h * 0.15;
    const bumpSegment = (axis, fixed, varStart, varEnd, active) => {
      if (!active) {
        return axis === 'x' ? `L ${varEnd} ${fixed}` : `L ${fixed} ${varEnd}`;
      }
      const mid1 = varStart + (varEnd - varStart) * 0.32;
      const mid2 = varStart + (varEnd - varStart) * 0.68;
      const bulge = fixed + r;
      if (axis === 'x') {
        return `L ${mid1} ${fixed} C ${mid1} ${bulge}, ${mid2} ${bulge}, ${mid2} ${fixed} L ${varEnd} ${fixed}`;
      }
      return `L ${fixed} ${mid1} C ${bulge} ${mid1}, ${bulge} ${mid2}, ${fixed} ${mid2} L ${fixed} ${varEnd}`;
    };

    let d = `M 0 0`;
    d += ' ' + bumpSegment('x', 0, 0, w, edges.top === 'notch');
    d += ' ' + bumpSegment('y', w, 0, h, edges.right === 'tab');
    d += ' ' + bumpSegment('x', h, w, 0, edges.bottom === 'tab');
    d += ' ' + bumpSegment('y', 0, h, 0, edges.left === 'notch');
    d += ' Z';
    return d;
  };

  // Puzzle-Piece Pfad generieren - Teile fügen sich automatisch zusammen
  const puzzlePiecePath = (w, h, hasLeftNotch, hasRightTab) => {
    const r = h * 0.16; // Größe der Nase/Kerbe
    const bump = (xBase, yStart, yEnd, active) => {
      if (!active) return `L ${xBase} ${yEnd}`;
      const yMid1 = yStart + (yEnd - yStart) * 0.32;
      const yMid2 = yStart + (yEnd - yStart) * 0.68;
      const bulgeX = xBase + r;
      return `L ${xBase} ${yMid1} C ${bulgeX} ${yMid1}, ${bulgeX} ${yMid2}, ${xBase} ${yMid2} L ${xBase} ${yEnd}`;
    };

    let d = `M 0 0 L ${w} 0`;
    d += ` ${bump(w, 0, h, hasRightTab).replace(/^L/, 'L')}`;
    d += ` L 0 ${h}`;
    d += ` ${bump(0, h, 0, hasLeftNotch).replace(/^L/, 'L')}`;
    d += ' Z';
    return d;
  };

  const polarToCartesian = (angle, radius) => {
    const radians = ((angle - 90) * Math.PI) / 180;
    return [250 + radius * Math.cos(radians), 250 + radius * Math.sin(radians)];
  };

  const describeArc = (startAngle, endAngle, radius) => {
    const start = polarToCartesian(endAngle, radius);
    const end = polarToCartesian(startAngle, radius);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return [
      'M',
      250,
      250,
      'L',
      start[0],
      start[1],
      'A',
      radius,
      radius,
      0,
      largeArc,
      0,
      end[0],
      end[1],
      'Z'
    ].join(' ');
  };

  // Herz-Leiste: character-weite Lebensanzeige, verliert 1/4 Herz pro gescheitertem Ziel/Aufgabe
  const renderHearts = () => {
    const icons = [];
    for (let i = 0; i < MAX_HEARTS; i++) {
      const fill = Math.max(0, Math.min(1, hearts - i));
      icons.push(
        <div key={i} className="relative w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0">
          <Heart className="absolute inset-0 w-full h-full text-slate-200" fill="currentColor" strokeWidth={0} />
          {fill > 0 && (
            <div className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" fill="currentColor" strokeWidth={0} />
            </div>
          )}
        </div>
      );
    }
    return icons;
  };

  // Aufklappbares Panel unter der Herzleiste: letzte 3 Aktionen + einstellbare Strafaufgabe für 0 Herzen
  const renderHeartLogPanel = () => (
    <div className="mt-3 max-w-xs border border-slate-200 rounded-lg p-3 bg-slate-50" onClick={(e) => e.stopPropagation()}>
      <p className="text-xs text-slate-500 font-light uppercase tracking-wide mb-2">Letzte Aktionen</p>
      {heartLog.length === 0 ? (
        <p className="text-xs text-slate-400 font-light mb-3">Noch keine Aktionen</p>
      ) : (
        <ul className="space-y-1 mb-3">
          {heartLog.map(entry => (
            <li key={entry.id} className="flex items-start gap-1.5 text-xs">
              <span className={`flex-shrink-0 ${entry.type === 'gain' ? 'text-green-600' : 'text-red-500'}`}>
                {entry.type === 'gain' ? '+' : '−'}
              </span>
              <span className="flex-1 text-slate-600 font-light">{entry.label}</span>
              <span className="text-slate-400 flex-shrink-0">
                {new Date(entry.at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="pt-2 border-t border-slate-200">
        <p className="text-xs text-slate-500 font-light uppercase tracking-wide mb-1">Strafaufgabe bei 0 Herzen</p>
        {editingPenaltyTask ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={penaltyTaskDraft}
              onChange={(e) => setPenaltyTaskDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPenaltyTask(penaltyTaskDraft.trim());
                  setEditingPenaltyTask(false);
                }
                if (e.key === 'Escape') setEditingPenaltyTask(false);
              }}
              onBlur={() => {
                setPenaltyTask(penaltyTaskDraft.trim());
                setEditingPenaltyTask(false);
              }}
              placeholder="z.B. 20 Liegestütze"
              className="flex-1 min-w-0 px-0 py-1 bg-white text-slate-900 border-b border-blue-400 outline-none font-light text-xs"
            />
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-700 font-light">
              {penaltyTask ? `"${penaltyTask}"` : 'Noch keine festgelegt'}
            </p>
            <button
              onClick={() => {
                setEditingPenaltyTask(true);
                setPenaltyTaskDraft(penaltyTask);
              }}
              className="text-xs text-blue-600 hover:text-blue-700 font-light flex-shrink-0"
            >
              {penaltyTask ? 'Ändern' : 'Festlegen'}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // Oberkategorien-Akkordeon für einen der drei GROUPED_TYPES: Add-Gruppe-Input, Puzzle-Piece-
  // Grid der Gruppen, aufgeklapptes Panel der aktiven Gruppe (Add-Item, Puzzle-Piece-Grid der
  // Mitglieder, Item-Liste mit Neu-anordnen/Auswählen, Umbenennen/Löschen). Als Closure-Funktion
  // (wie renderHearts) statt eigenes Component mit Props-Threading, da sie nur innerhalb von
  // YuYuApp aufgerufen wird und direkt auf items/itemGroups/selectedGroupId usw. zugreifen kann.
  const renderGroupedSection = (type, label, labelPlural, levelLabel) => {
    const groups = itemGroups.filter(g => g.type === type);
    return (
      <div className="mb-8 sm:mb-10">
        <div className="max-w-sm mb-4">
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addGroup(type)}
            placeholder={`Neue Oberkategorie (${label})`}
            className="w-full px-0 py-2 bg-white text-slate-900 border-b border-slate-200 placeholder-slate-400 focus:border-blue-500 outline-none font-light text-base"
          />
        </div>
        {groups.length > 0 && (
          <>
            {/* Oberkategorien: eigene Puzzleteile, die sich zu einem großen Ganzen zusammenfügen */}
            <div className="flex justify-center overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
              {(() => {
                const perRow = 3;
                const pieceWidth = 168;
                const pieceHeight = 128;
                const rows = [];
                for (let i = 0; i < groups.length; i += perRow) {
                  rows.push(groups.slice(i, i + perRow));
                }
                const maxRowLength = Math.min(groups.length, perRow);
                const svgWidth = maxRowLength * pieceWidth + 20;
                const svgHeight = rows.length * pieceHeight + 20;

                return (
                  <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
                    {rows.map((rowGroups, rowIdx) =>
                      rowGroups.map((group, colIdx) => {
                        const edges = {
                          left: colIdx > 0 ? 'notch' : 'flat',
                          right: colIdx < rowGroups.length - 1 ? 'tab' : 'flat',
                          top: rowIdx > 0 && rows[rowIdx - 1][colIdx] ? 'notch' : 'flat',
                          bottom: rows[rowIdx + 1] && rows[rowIdx + 1][colIdx] ? 'tab' : 'flat'
                        };
                        const path = puzzlePieceGridPath(pieceWidth, pieceHeight, edges);
                        const x = 10 + colIdx * pieceWidth;
                        const y = 10 + rowIdx * pieceHeight;
                        const groupItems = items.filter(i => i.type === type && i.groupId === group.id);
                        const groupXP = groupItems.reduce((sum, i) => sum + (i.xp || 0), 0);
                        const groupLevel = computeLevelFromXP(groupXP).level;
                        const isEditingGroup = editingGroupId === group.id;
                        const isOpen = selectedGroupId === group.id;

                        const togglePiece = () => {
                          if (isEditingGroup) return;
                          setSelectedGroupId(prev => (prev === group.id ? null : group.id));
                          setSelectionMode(false);
                          setSelectedIds([]);
                          setReorderMode(false);
                          setDraggedId(null);
                          setDragOverId(null);
                        };

                        return (
                          <g
                            key={group.id}
                            transform={`translate(${x}, ${y})`}
                            onClick={togglePiece}
                            className="cursor-pointer"
                          >
                            <path
                              d={path}
                              fill={isOpen ? '#2f4f3a' : '#fdfcf9'}
                              stroke="#d4af37"
                              strokeWidth={isOpen ? 1.25 : 0.75}
                              className="transition-colors"
                            />
                            <foreignObject x="12" y="8" width={pieceWidth - 24} height={pieceHeight - 16}>
                              <div className="h-full flex flex-col items-center justify-center text-center px-1">
                                <h3
                                  className={`text-xs sm:text-sm font-medium leading-tight break-words ${isOpen ? '' : 'text-slate-900'}`}
                                  style={isOpen ? { color: '#d4af37' } : undefined}
                                >
                                  {group.name}
                                </h3>
                                <p
                                  className={`text-[10px] font-light mt-1 leading-tight ${isOpen ? '' : 'text-slate-400'}`}
                                  style={isOpen ? { color: '#d4af37', opacity: 0.75 } : undefined}
                                >
                                  {groupItems.length} {groupItems.length === 1 ? label : labelPlural} · {levelLabel} {groupLevel}
                                </p>
                              </div>
                            </foreignObject>
                          </g>
                        );
                      })
                    )}
                  </svg>
                );
              })()}
            </div>

            {/* Aufgeklapptes Panel für die aktive Oberkategorie */}
            {(() => {
              const openGroup = groups.find(g => g.id === selectedGroupId);
              if (!openGroup) return null;
              return (
                <div key={openGroup.id} className="max-w-md mx-auto mt-6 border border-blue-200 rounded-lg overflow-hidden">
                  <div className="px-4 pb-6 pt-4">
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <h3 className="text-sm text-slate-900 font-medium">{openGroup.name}</h3>
                      <button
                        onClick={() => setSelectedGroupId(null)}
                        className="p-1.5 -m-1.5 text-slate-300 hover:text-slate-600 transition flex-shrink-0"
                      >
                        <X className="w-4 h-4" strokeWidth={1.5} />
                      </button>
                    </div>

                    {/* Add Item - nur innerhalb der offenen Oberkategorie möglich */}
                    <div className="mb-8 max-w-sm">
                      <input
                        type="text"
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && newItemName.trim()) {
                            addItem(newItemName);
                            setNewItemName('');
                          }
                        }}
                        placeholder={`${label} hinzufügen`}
                        className="w-full px-0 py-2 bg-white text-slate-900 border-b border-slate-200 placeholder-slate-400 focus:border-blue-500 outline-none font-light text-base"
                      />
                    </div>

                    {/* Puzzle-Piece Visualisierung */}
                    {sectionItems.length > 0 && (
                      <div className="mb-8 pb-6 border-b border-slate-100">
                        <h2 className="text-sm font-light text-slate-600 tracking-wide uppercase mb-6 sm:mb-8 text-center">
                          Deine {labelPlural} fügen sich zusammen
                        </h2>
                        <div className="flex justify-center overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
                          {(() => {
                            const perRow = 3;
                            const pieceWidth = 96;
                            const pieceHeight = 74;
                            const rows = [];
                            for (let i = 0; i < sectionItems.length; i += perRow) {
                              rows.push(sectionItems.slice(i, i + perRow));
                            }
                            const maxRowLength = Math.min(sectionItems.length, perRow);
                            const svgWidth = maxRowLength * pieceWidth + 20;
                            const svgHeight = rows.length * pieceHeight + 20;

                            return (
                              <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
                                {rows.map((rowItems, rowIdx) =>
                                  rowItems.map((item, colIdx) => {
                                    const edges = {
                                      left: colIdx > 0 ? 'notch' : 'flat',
                                      right: colIdx < rowItems.length - 1 ? 'tab' : 'flat',
                                      top: rowIdx > 0 && rows[rowIdx - 1][colIdx] ? 'notch' : 'flat',
                                      bottom: rows[rowIdx + 1] && rows[rowIdx + 1][colIdx] ? 'tab' : 'flat'
                                    };
                                    const path = puzzlePieceGridPath(pieceWidth, pieceHeight, edges);
                                    const x = 10 + colIdx * pieceWidth;
                                    const y = 10 + rowIdx * pieceHeight;
                                    const nameLines = wrapPuzzleText(item.name, 12);
                                    const nameFontSize = nameLines.some(l => l.length > 10) ? 7.5 : 8.5;

                                    return (
                                      <g key={item.id} transform={`translate(${x}, ${y})`}>
                                        <path
                                          d={path}
                                          fill="#fdfcf9"
                                          stroke="#d4af37"
                                          strokeWidth="0.75"
                                        />
                                        <text
                                          x={pieceWidth / 2}
                                          textAnchor="middle"
                                          fill="#1e3a8a"
                                          fontSize={nameFontSize}
                                          fontWeight="400"
                                          fontFamily="'Lora', serif"
                                        >
                                          {nameLines.map((line, i) => (
                                            <tspan
                                              key={i}
                                              x={pieceWidth / 2}
                                              y={pieceHeight / 2 - 14 + i * (nameFontSize + 2)}
                                            >
                                              {line}
                                            </tspan>
                                          ))}
                                        </text>
                                        <text
                                          x={pieceWidth / 2}
                                          y={pieceHeight / 2 + 14}
                                          textAnchor="middle"
                                          fill="#d4af37"
                                          fontSize="9"
                                          fontWeight="600"
                                          fontFamily="'Lora', serif"
                                        >
                                          Lv. {computeLevelFromXP(item.xp || 0).level}
                                        </text>
                                        {item.createdAt && (
                                          <text
                                            x={pieceWidth / 2}
                                            y={pieceHeight / 2 + 27}
                                            textAnchor="middle"
                                            fill="#000000"
                                            fontSize="7"
                                            fontWeight="400"
                                            fontFamily="'Lora', serif"
                                          >
                                            {new Date(item.createdAt).toLocaleDateString('de-DE')}
                                          </text>
                                        )}
                                      </g>
                                    );
                                  })
                                )}
                              </svg>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                    {/* Items list - selbst ein Toggle für die ganze Liste */}
                    <div className="max-w-md space-y-4">
                      <div
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => {
                          setVirtuesListExpanded(prev => {
                            const next = !prev;
                            if (!next) {
                              setReorderMode(false);
                              setSelectionMode(false);
                              setSelectedIds([]);
                            }
                            return next;
                          });
                        }}
                      >
                        <div className="flex items-center gap-1.5">
                          <ChevronDown
                            className={`w-3.5 h-3.5 text-slate-400 transition-transform flex-shrink-0 ${virtuesListExpanded ? '' : '-rotate-90'}`}
                            strokeWidth={1.5}
                          />
                          <h2 className="text-sm font-light text-slate-600 tracking-wide uppercase">
                            {labelPlural}
                          </h2>
                        </div>
                        {virtuesListExpanded && (
                          <div className="flex items-center gap-3">
                            {selectionMode && selectedIds.length > 0 && (
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteSelectedItems(); }}
                                className="text-xs text-red-500 hover:text-red-600 font-light transition"
                              >
                                Löschen ({selectedIds.length})
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setReorderMode(!reorderMode);
                                setSelectionMode(false);
                                setSelectedIds([]);
                              }}
                              className={`text-xs font-light tracking-wide transition ${
                                reorderMode ? 'text-blue-600' : 'text-slate-400 hover:text-blue-600'
                              }`}
                            >
                              {reorderMode ? 'Fertig' : 'Neu anordnen'}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectionMode(!selectionMode);
                                setSelectedIds([]);
                                setReorderMode(false);
                              }}
                              className={`text-xs font-light tracking-wide transition ${
                                selectionMode ? 'text-blue-600' : 'text-slate-400 hover:text-blue-600'
                              }`}
                            >
                              {selectionMode ? 'Fertig' : 'Auswählen'}
                            </button>
                          </div>
                        )}
                      </div>

                      {virtuesListExpanded && reorderMode && (
                        <p className="text-xs text-slate-400 font-light -mt-2">Am Griff ziehen, um die Reihenfolge zu ändern</p>
                      )}

                      {virtuesListExpanded && (
                      <div className="space-y-4">
                        {sectionItems.map((item) => (
                          <div
                            key={item.id}
                            data-item-id={item.id}
                            className={`group flex items-start gap-3 transition ${
                              selectionMode ? 'cursor-pointer' : ''
                            } ${
                              draggedId === item.id ? 'opacity-40' : 'opacity-100'
                            } ${
                              reorderMode && dragOverId === item.id && draggedId !== item.id
                                ? 'outline outline-2 outline-blue-300 rounded-lg'
                                : ''
                            }`}
                            onClick={(e) => { e.stopPropagation(); selectionMode && toggleSelectItem(item.id); }}
                          >
                            {reorderMode && (
                              <div
                                onPointerDown={(e) => handleDragHandlePointerDown(e, item.id)}
                                onPointerMove={handleDragHandlePointerMove}
                                onPointerUp={handleDragHandlePointerUp}
                                onPointerCancel={handleDragHandlePointerUp}
                                className="mt-0.5 -my-1.5 -ml-1.5 p-1.5 flex-shrink-0 text-slate-400 select-none touch-none cursor-grab active:cursor-grabbing"
                              >
                                ⠿
                              </div>
                            )}
                            {selectionMode && (
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleSelectItem(item.id); }}
                                className="mt-0.5 flex-shrink-0"
                              >
                                {selectedIds.includes(item.id) ? (
                                  <CheckCircle2 className="w-4 h-4 text-blue-600" strokeWidth={1.5} />
                                ) : (
                                  <Circle className="w-4 h-4 text-slate-300" strokeWidth={1.5} />
                                )}
                              </button>
                            )}

                            <div className="flex-1">
                              <div className="flex justify-between items-start mb-2">
                                <h3 className={`text-sm font-light ${
                                  item.failed ? 'text-slate-400 line-through' : item.completed ? 'text-green-700 line-through' : 'text-slate-900'
                                }`}>{item.name}</h3>
                                {!selectionMode && (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
                                      className="p-1.5 -m-1.5 text-slate-300 hover:text-red-500 transition opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                                    >
                                      <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                                    </button>
                                  </div>
                                )}
                              </div>

                              {(() => {
                                const { level, xpInLevel, xpNeeded } = computeLevelFromXP(item.xp || 0);
                                return (
                                  <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs text-slate-400">Level</span>
                                      <span className="text-sm font-light text-blue-600">{level}{xpNeeded === null ? ' (MAX)' : ''}</span>
                                    </div>
                                    <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all"
                                        style={{ width: `${xpNeeded ? (xpInLevel / xpNeeded) * 100 : 100}%` }}
                                      />
                                    </div>
                                    <p className="text-xs text-slate-400 text-right">
                                      {xpNeeded ? `${xpInLevel}/${xpNeeded} XP` : `${item.xp || 0} XP`}
                                    </p>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        ))}
                      </div>
                      )}
                    </div>

                    {/* Bearbeiten/Löschen der Oberkategorie */}
                    <div className="max-w-md mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                      {editingGroupId === openGroup.id ? (
                        <input
                          autoFocus
                          value={editingGroupName}
                          onChange={(e) => setEditingGroupName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              renameGroup(openGroup.id, editingGroupName);
                              setEditingGroupId(null);
                            }
                            if (e.key === 'Escape') setEditingGroupId(null);
                          }}
                          onBlur={() => {
                            renameGroup(openGroup.id, editingGroupName);
                            setEditingGroupId(null);
                          }}
                          className="flex-1 min-w-0 text-sm text-slate-900 font-medium bg-transparent border-b border-blue-400 outline-none"
                        />
                      ) : (
                        <button
                          onClick={() => {
                            setEditingGroupId(openGroup.id);
                            setEditingGroupName(openGroup.name);
                          }}
                          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-600 transition"
                        >
                          <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />
                          Oberkategorie umbenennen
                        </button>
                      )}
                      <button
                        onClick={() => deleteGroup(openGroup.id, type, label, labelPlural)}
                        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-500 transition flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                        Löschen
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>
    );
  };

  // Auth guard
  if (session === undefined) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }} />;
  }
  if (session === null) {
    return <LoginScreen />;
  }

  // HUB VIEW
  if (section === 'hub') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 sm:p-6">
        {/* Link zur PIFA-Website - eigene App, aber selbe Zugangsdaten/Konto */}
        <a
          href="https://pifa-esports.store/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          title="Zu PIFA"
          className="fixed top-4 right-4 sm:top-6 sm:right-6 p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"
        >
          <Clipboard className="w-5 h-5" strokeWidth={1.5} />
        </a>

        <div className="mb-10 sm:mb-16 text-center">
          <h1 className="text-5xl sm:text-6xl font-light text-slate-900 tracking-tight mb-2">
            YuYu
          </h1>
          <p className="text-slate-400 text-sm font-light">your growth matters</p>
        </div>

        {/* SVG Pie Chart Navigation - Minimalist */}
        <div className="mb-8">
          <svg viewBox="0 0 500 500" className="w-[min(88vw,480px)] h-[min(88vw,480px)]">
            <defs>
              {/* Reine Bogen-Pfade (ohne Linien zur Mitte) für Text */}
              {categories.map((cat) => {
                const radius = 175;
                const midAngle = (cat.startAngle + cat.endAngle) / 2;
                // Unten (90°-270°) braucht umgekehrte Richtung, damit Text nicht kopfüber ist
                const isBottomHalf = midAngle > 90 && midAngle < 270;
                const a1 = isBottomHalf ? cat.endAngle : cat.startAngle;
                const a2 = isBottomHalf ? cat.startAngle : cat.endAngle;
                const sweep = isBottomHalf ? 0 : 1;
                const [x1, y1] = polarToCartesian(a1, radius);
                const [x2, y2] = polarToCartesian(a2, radius);
                const largeArc = Math.abs(cat.endAngle - cat.startAngle) > 180 ? 1 : 0;
                const d = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} ${sweep} ${x2} ${y2}`;

                return (
                  <path key={`path-${cat.id}`} id={`curve-${cat.id}`} d={d} fill="none" />
                );
              })}
            </defs>

            {/* Outer circle border - pastel dunkelblau */}
            <circle cx="250" cy="250" r="235" fill="none" stroke="#7c9fd6" strokeWidth="1" />

            {/* Segments - hier passiert der Klick */}
            {categories.map((cat) => {
              const outerRadius = 235;
              const locked = hearts <= 0 && cat.id !== 'todos';

              return (
                <g key={cat.id}>
                  <path
                    d={describeArc(cat.startAngle, cat.endAngle, outerRadius)}
                    fill={locked ? '#f1f5f9' : '#ffffff'}
                    stroke="#e5e7eb"
                    strokeWidth="0.5"
                    className={`transition-colors ${locked ? 'cursor-not-allowed' : 'cursor-pointer hover:fill-slate-50'}`}
                    onClick={() => { if (locked) return; setSection(cat.id); }}
                    style={{ opacity: locked ? 0.4 : 0.8 }}
                  />

                  <line
                    x1="250"
                    y1="250"
                    x2={polarToCartesian(cat.startAngle, outerRadius)[0]}
                    y2={polarToCartesian(cat.startAngle, outerRadius)[1]}
                    stroke="#7c9fd6"
                    strokeWidth="1"
                    opacity="0.6"
                    pointerEvents="none"
                  />
                </g>
              );
            })}

            {/* Center circle - führt zur YOU-Auswahl (Tugend/Gewohnheiten/Fähigkeiten), gesperrt bei 0 Herzen */}
            <circle
              cx="250" cy="250" r="140"
              fill="white" stroke="#7c9fd6" strokeWidth="1.5"
              onClick={() => { if (hearts <= 0) return; setSelectedGroupId(null); setSection('you'); }}
              className={`transition ${hearts <= 0 ? 'cursor-not-allowed' : 'cursor-pointer hover:fill-slate-50'}`}
            />
            <circle
              cx="250" cy="250" r="135"
              fill={hearts <= 0 ? '#e2e8f0' : '#f8fafc'}
              onClick={() => { if (hearts <= 0) return; setSelectedGroupId(null); setSection('you'); }}
              className={`transition ${hearts <= 0 ? 'cursor-not-allowed' : 'cursor-pointer hover:fill-slate-50'}`}
            />

            {/* Center text - schwarz */}
            <text x="250" y="245" textAnchor="middle" dy="0.3em" fill="#000000" fontSize="14" fontWeight="300" pointerEvents="none" letterSpacing="2">
              YOU
            </text>

            {/* Labels - reine Anzeige, Klick passiert auf dem Segment darunter */}
            {categories.map((cat) => (
              <text key={`label-${cat.id}`} fill="#334155" fontSize="12" fontWeight="400" pointerEvents="none" fontFamily="'Lora', serif" letterSpacing="1.2">
                <textPath href={`#curve-${cat.id}`} startOffset="50%" textAnchor="middle">
                  {cat.label}
                </textPath>
              </text>
            ))}
          </svg>
        </div>

        {/* Bottom info */}
        <p className="text-slate-400 text-xs font-light tracking-wide mt-4">click a segment to begin</p>

        {/* Backup + Abmelden */}
        <div className="flex items-center gap-4 mt-8">
          <button
            onClick={exportData}
            className="text-xs text-slate-400 hover:text-blue-600 transition font-light"
          >
            Daten exportieren
          </button>
          <button
            onClick={() => importFileInputRef.current?.click()}
            className="text-xs text-slate-400 hover:text-blue-600 transition font-light"
          >
            Daten importieren
          </button>
          <input
            ref={importFileInputRef}
            type="file"
            accept="application/json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importData(file);
              e.target.value = '';
            }}
            className="hidden"
          />
          <button
            onClick={() => sb.auth.signOut()}
            className="text-xs text-slate-400 hover:text-red-500 transition font-light"
          >
            Abmelden
          </button>
        </div>
      </div>
    );
  }

  // YOU VIEW: Dreieck-Auswahl zwischen Tugend, Gewohnheiten und Fähigkeiten
  if (section === 'you') {
    const goTo = (type) => {
      setSelectedGroupId(null);
      setSelectionMode(false);
      setSelectedIds([]);
      setReorderMode(false);
      if (type === 'principles') {
        setSection('principles');
      } else {
        setSection('skills');
        setSkillsTab(type);
      }
    };

    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-xs mb-10 sm:mb-16 flex items-center gap-3">
          <button
            onClick={() => setSection('hub')}
            className="p-2.5 -ml-2.5 hover:bg-blue-50 rounded transition text-blue-600 hover:text-blue-700"
          >
            <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
          </button>
          <h1 className="text-2xl sm:text-3xl font-light text-slate-900 tracking-tight">YOU</h1>
        </div>

        <div className="relative w-[min(80vw,300px)] h-[min(80vw,300px)] sm:w-[320px] sm:h-[320px]">
          {[
            { type: 'principles', label: 'Tugend', levelLabel: 'Lvl', position: 'left-1/2 top-0 -translate-x-1/2' },
            { type: 'habits', label: 'Gewohnheiten', levelLabel: 'Lvl', position: 'left-0 bottom-0' },
            { type: 'skills', label: 'Fähigkeiten', levelLabel: 'Lvl', position: 'right-0 bottom-0' },
          ].map(({ type, label, levelLabel, position }) => {
            const totalXP = items.filter(i => i.type === type).reduce((sum, i) => sum + (i.xp || 0), 0);
            const level = computeLevelFromXP(totalXP).level;
            return (
              <button
                key={type}
                type="button"
                onClick={() => goTo(type)}
                className={`absolute ${position} w-28 h-28 sm:w-32 sm:h-32 transition hover:opacity-70`}
              >
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  <polygon points="50,4 97,92 3,92" fill="white" stroke="#7c9fd6" strokeWidth="1.5" />
                </svg>
                <span className="absolute inset-x-0 bottom-6 sm:bottom-7 text-center text-[10px] sm:text-xs font-light tracking-wide text-slate-900 px-2">
                  {label}
                </span>
                <span className="absolute inset-x-0 bottom-3 text-center text-[9px] sm:text-[10px] font-light text-slate-400 px-2">
                  {levelLabel} {level}
                </span>
              </button>
            );
          })}
        </div>

        <p className="text-slate-400 text-xs font-light tracking-wide mt-8">click a corner to begin</p>
      </div>
    );
  }

  // TODOIST-STYLE VIEW für Aufgaben - eine einzige flache Liste, keine Projekte
  if (section === 'todos') {
    const openTodos = todos.filter(t => !t.completed && !t.failed);
    const doneTodos = todos.filter(t => t.completed);
    const failedTodos = todos.filter(t => t.failed);

    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-2xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
          {/* Header */}
          <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
            <button
              onClick={() => setSection('hub')}
              className="p-2.5 -ml-2.5 hover:bg-blue-50 rounded transition text-blue-600 hover:text-blue-700"
            >
              <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
            </button>
            <div>
              <h1 className="text-2xl font-light text-slate-900 tracking-tight flex items-center gap-2">
                Aufgabe
              </h1>
              <p className="text-xs text-slate-400 font-light mt-0.5">{openTodos.length} offen</p>
            </div>
          </div>

          {/* Strafaufgabe: erscheint, sobald 0 Herzen erreicht sind - andere Bereiche sind währenddessen gesperrt */}
          {hearts <= 0 && (
            <div className="mb-6 sm:mb-8 p-4 border border-red-200 bg-red-50 rounded-lg">
              <p className="text-xs text-red-500 font-light uppercase tracking-wide mb-1">Strafaufgabe</p>
              <p className="text-sm text-slate-900">
                {penaltyTask || 'Noch keine festgelegt - klicke auf die Herzleiste, um eine einzutragen.'}
              </p>
            </div>
          )}

          {/* Aufgabe hinzufügen - schlicht, wie ein normaler Listeneintrag */}
          <div className="mb-6 sm:mb-8 py-1.5 px-1">
            <div className="flex items-center gap-3">
              <Circle className="w-4 h-4 text-slate-200 flex-shrink-0" strokeWidth={1.5} />
              <TodoWizardInput
                placeholder="+ Aufgabe hinzufügen"
                virtues={allVirtueItems}
                skills={allSkillItems}
                lifeAreas={allLifeAreaItems}
                onSubmit={({ text, linkedIds, linkedSkillIds, habit, lifeAreaId }) =>
                  addTodo(text, linkedIds, { linkedSkillIds, habit, lifeAreaId })
                }
                wrapperClassName="flex-1 min-w-0"
                className="w-full text-base sm:text-sm font-light text-slate-400 placeholder-slate-300 outline-none focus:text-slate-900"
              />
            </div>
          </div>

          {/* Aufgabenliste */}
          <div className="space-y-0.5">
            {todos.length === 0 ? (
              <p className="text-slate-400 text-sm font-light text-center py-12">Noch keine Aufgaben — leg los ✍️</p>
            ) : (
              <>
                {openTodos.map(todo => {
                  const todoVirtues = (todo.linkedItems || []).map(vid => allVirtueItems.find(v => v.id === vid)).filter(Boolean);
                  const todoSkills = (todo.linkedSkillIds || []).map(sid => allSkillItems.find(s => s.id === sid)).filter(Boolean);
                  const todoLifeArea = allLifeAreaItems.find(a => a.id === todo.lifeAreaId);
                  const hasExtras = todo.habit || todoLifeArea || todoVirtues.length > 0 || todoSkills.length > 0;
                  return (
                  <div key={todo.id} className="flex items-start gap-3 py-1.5 px-1 group/task hover:bg-slate-50 rounded transition">
                    <button
                      onClick={() => toggleTodo(todo.id)}
                      className="mt-0.5 text-slate-300 hover:text-blue-500 transition flex-shrink-0"
                    >
                      <Circle className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                    <div className="flex-1 min-w-0">
                      {editingTodoId === todo.id ? (
                        <input
                          autoFocus
                          value={editingTodoText}
                          onChange={(e) => setEditingTodoText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              editTodo(todo.id, editingTodoText);
                              setEditingTodoId(null);
                            }
                            if (e.key === 'Escape') setEditingTodoId(null);
                          }}
                          onBlur={() => {
                            editTodo(todo.id, editingTodoText);
                            setEditingTodoId(null);
                          }}
                          className="w-full text-sm font-light text-slate-900 bg-transparent border-b border-blue-400 outline-none"
                        />
                      ) : (
                        <span className="text-sm font-light text-slate-900">{todo.text}</span>
                      )}
                      {hasExtras && (
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          {todoLifeArea && (
                            <span className="text-[10px] text-blue-600 font-light">{todoLifeArea.name}</span>
                          )}
                          {todo.habit && (
                            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded-full">{todo.habit}</span>
                          )}
                          {todoVirtues.map(v => (
                            <span key={v.id} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[10px] rounded-full">{v.name}</span>
                          ))}
                          {todoSkills.map(s => (
                            <span key={s.id} className="px-1.5 py-0.5 bg-violet-50 text-violet-700 text-[10px] rounded-full">{s.name}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setEditingTodoId(todo.id);
                        setEditingTodoText(todo.text);
                      }}
                      title="Bearbeiten"
                      className="mt-0.5 p-1.5 -m-1.5 text-slate-300 hover:text-blue-500 transition opacity-100 sm:opacity-0 sm:group-hover/task:opacity-100 flex-shrink-0"
                    >
                      <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </button>
                    <button
                      onClick={() => failTodo(todo.id)}
                      title="Als gescheitert markieren"
                      className="mt-0.5 p-1.5 -m-1.5 text-slate-300 hover:text-orange-500 transition opacity-100 sm:opacity-0 sm:group-hover/task:opacity-100 flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </button>
                    <button
                      onClick={() => deleteTodo(todo.id)}
                      className="mt-0.5 p-1.5 -m-1.5 text-slate-300 hover:text-red-400 transition opacity-100 sm:opacity-0 sm:group-hover/task:opacity-100 flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </button>
                  </div>
                  );
                })}

                {/* Gescheiterte Aufgaben */}
                {failedTodos.length > 0 && (
                  <div className="pt-1">
                    {failedTodos.map(todo => (
                      <div key={todo.id} className="flex items-center gap-3 py-1.5 px-1 group/task">
                        <X className="w-4 h-4 text-orange-400 flex-shrink-0" strokeWidth={1.5} />
                        <span className="flex-1 text-sm font-light text-slate-400 line-through">{todo.text}</span>
                        <button
                          onClick={() => deleteTodo(todo.id)}
                          className="p-1.5 -m-1.5 text-slate-300 hover:text-red-400 transition opacity-100 sm:opacity-0 sm:group-hover/task:opacity-100 flex-shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Erledigte Aufgaben */}
                {doneTodos.length > 0 && (
                  <div className="pt-1">
                    {doneTodos.map(todo => (
                      <div key={todo.id} className="flex items-center gap-3 py-1.5 px-1 group/task">
                        <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0" strokeWidth={1.5} />
                        <span className="flex-1 text-sm font-light text-slate-400 line-through">{todo.text}</span>
                        <button
                          onClick={() => deleteTodo(todo.id)}
                          className="p-1.5 -m-1.5 text-slate-300 hover:text-red-400 transition opacity-100 sm:opacity-0 sm:group-hover/task:opacity-100 flex-shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // TUGEND VIEW: Hauptseite zeigt nur Add-Feld + Oberkategorien-Liste;
  // Klick auf eine Oberkategorie klappt sie als Akkordeon-Panel auf (nur eine gleichzeitig offen).
  if (section === 'principles') {
    const principlesGroups = itemGroups.filter(g => g.type === 'principles');
    return (
      <div className="min-h-screen bg-white p-4 sm:p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-start gap-3 sm:gap-6 mb-6 pb-4 sm:mb-12 sm:pb-8 border-b border-slate-200">
            <button
              onClick={() => {
                setSection('hub');
                setSelectedGroupId(null);
                setSelectionMode(false);
                setSelectedIds([]);
                setReorderMode(false);
              }}
              className="p-2.5 -ml-2.5 hover:bg-blue-50 rounded transition text-blue-600 hover:text-blue-700"
            >
              <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
            </button>
            <div>
              <h1 className="text-2xl sm:text-4xl font-light text-slate-900 tracking-tight">
                {currentCategory?.label}
              </h1>
              <p className="text-sm text-slate-400 font-light mt-1">{principlesGroups.length} {principlesGroups.length === 1 ? 'Oberkategorie' : 'Oberkategorien'}</p>

              {/* Herzen: character-weite Lebensanzeige, klickbar für Verlauf + Strafaufgabe */}
              <div className="mt-3 cursor-pointer" onClick={() => setShowHeartLog(prev => !prev)}>
                <div className="flex gap-0.5 sm:gap-1">{renderHearts()}</div>
                <p className="text-[10px] sm:text-xs text-slate-400 font-light mt-1">{Number(hearts.toFixed(2))} / {MAX_HEARTS} Herzen</p>
              </div>
              {showHeartLog && renderHeartLogPanel()}
            </div>
          </div>

          {renderGroupedSection('principles', 'Tugend', 'Tugenden', 'Lvl')}
        </div>
      </div>
    );
  }


  // LEBENSBEREICH VIEW: vier feste Bereiche als Viertel eines großen Herzens; jedes Viertel
  // klickbar für eine Pop-up-Detailseite. Jeder Bereich sammelt XP durch abgeschlossene
  // Ziele/Aufgaben, die ihm zugeordnet sind (siehe gainLifeAreaXP).
  if (section === 'life-areas') {
    // Eigene Detailseite eines Lebensbereichs statt Pop-up-Overlay
    const openArea = allLifeAreaItems.find(a => a.id === selectedLifeAreaId);
    if (openArea) {
      const linkedGoals = items.filter(i => i.type === 'goals' && i.lifeAreaId === openArea.id);
      const linkedTodos = todos.filter(t => t.lifeAreaId === openArea.id);
      const { level: areaLevel, xpInLevel: areaXpInLevel, xpNeeded: areaXpNeeded } = computeLevelFromXP(openArea.xp || 0);
      const pct = areaXpNeeded ? (areaXpInLevel / areaXpNeeded) * 100 : 100;
      return (
        <div className="min-h-screen bg-white p-4 sm:p-8">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-start gap-3 sm:gap-6 mb-6 pb-4 sm:mb-12 sm:pb-8 border-b border-slate-200">
              <button
                onClick={() => {
                  setSelectedLifeAreaId(null);
                  setEditingEmployerLink(false);
                  setEmployerLinkMessage('');
                }}
                className="p-2.5 -ml-2.5 hover:bg-blue-50 rounded transition text-blue-600 hover:text-blue-700"
              >
                <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
              </button>
              <div>
                <h1 className="text-2xl sm:text-4xl font-light text-slate-900 tracking-tight">{openArea.name}</h1>
                <p className="text-sm text-slate-400 font-light mt-1">Lebensbereich</p>
              </div>
            </div>

            <div className="max-w-sm mb-8">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-slate-400">Level {areaLevel}{areaXpNeeded === null ? ' (MAX)' : ''}</span>
                <span className="text-xs text-slate-400">
                  {areaXpNeeded ? `${areaXpInLevel}/${areaXpNeeded} XP` : `${openArea.xp || 0} XP`}
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-rose-400 to-rose-600 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            {openArea.name === 'Persönlich' && (
              <div className="max-w-sm mb-8 pb-8 border-b border-slate-100 space-y-5">
                {[
                  { type: 'principles', label: 'Tugenden', levelLabel: 'Lvl' },
                  { type: 'habits', label: 'Gewohnheiten', levelLabel: 'Lvl' },
                  { type: 'skills', label: 'Fähigkeiten', levelLabel: 'Lvl' },
                ].map(({ type, label, levelLabel }) => {
                  const groups = itemGroups.filter(g => g.type === type);
                  if (groups.length === 0) return null;
                  return (
                    <div key={type}>
                      <p className="text-xs text-slate-400 uppercase tracking-wide mb-1.5">{label}</p>
                      <div className="space-y-1">
                        {groups.map(g => {
                          const groupXP = items.filter(i => i.type === type && i.groupId === g.id).reduce((sum, i) => sum + (i.xp || 0), 0);
                          const level = computeLevelFromXP(groupXP).level;
                          return (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => {
                                setSection(type === 'principles' ? 'principles' : 'skills');
                                if (type !== 'principles') setSkillsTab(type);
                                setSelectedGroupId(g.id);
                                setSelectionMode(false);
                                setSelectedIds([]);
                                setReorderMode(false);
                              }}
                              className="flex justify-between items-center w-full text-sm text-slate-700 hover:text-blue-600 transition"
                            >
                              <span>{g.name}</span>
                              <span className="text-slate-400 text-xs">{levelLabel} {level}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {openArea.name === 'Arbeit' && (
              <div className="max-w-sm mb-8 pb-8 border-b border-slate-100">
                {(!employerLink?.job_title || editingEmployerLink) ? (
                  <JobEmployerForm
                    employers={employers}
                    initialJobTitle={employerLink?.job_title}
                    initialEmployerId={employerLink?.employer_id}
                    onSubmit={(jobTitle, employerId) => {
                      upsertEmployerLink(jobTitle, employerId);
                      setEditingEmployerLink(false);
                    }}
                    onCancel={employerLink?.job_title ? () => setEditingEmployerLink(false) : undefined}
                  />
                ) : (() => {
                  const employer = employers.find(e => e.id === employerLink.employer_id);
                  return (
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wide mb-1.5">Job</p>
                      <p className="text-sm text-slate-900 mb-1">{employerLink.job_title}</p>
                      <p className="text-xs text-slate-400 font-light mb-3">
                        {employer ? employer.name : 'Kein Arbeitgeber angegeben'}
                      </p>

                      {employer?.linkable && !employerLink.linked && (
                        <div className="mb-3 p-3 bg-slate-50 rounded-lg space-y-2">
                          <p className="text-xs text-slate-500">
                            Verknüpfe dein Konto mit {employer.name}, um Daten auszutauschen.
                          </p>
                          <div className="flex flex-wrap gap-3">
                            <button
                              type="button"
                              onClick={() => window.open(employer.link_url, '_blank', 'noopener')}
                              className="text-xs text-blue-600 hover:text-blue-700 font-light"
                            >
                              Bei {employer.name} registrieren/einloggen
                            </button>
                            <button
                              type="button"
                              onClick={confirmEmployerLink}
                              className="text-xs text-blue-600 hover:text-blue-700 font-light"
                            >
                              Verknüpfung bestätigen
                            </button>
                          </div>
                          {employerLinkMessage && (
                            <p className="text-xs text-orange-500">{employerLinkMessage}</p>
                          )}
                        </div>
                      )}

                      {employer?.linkable && employerLink.linked && (
                        <p className="text-xs text-green-600 mb-3">Verknüpft ✓</p>
                      )}

                      <button
                        type="button"
                        onClick={() => setEditingEmployerLink(true)}
                        className="text-xs text-slate-400 hover:text-blue-600 font-light transition"
                      >
                        Bearbeiten
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}

            {(linkedGoals.length > 0 || linkedTodos.length > 0) ? (
              <div className="max-w-md space-y-4">
                {linkedGoals.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-1.5">Ziele</p>
                    <div className="space-y-1">
                      {linkedGoals.map(g => (
                        <p
                          key={g.id}
                          className={`text-sm font-light ${
                            g.completed ? 'text-green-700 line-through' : g.failed ? 'text-slate-400 line-through' : 'text-slate-900'
                          }`}
                        >
                          {g.name}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
                {linkedTodos.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-1.5">Aufgaben</p>
                    <div className="space-y-1">
                      {linkedTodos.map(t => (
                        <p
                          key={t.id}
                          className={`text-sm font-light ${
                            t.completed ? 'text-green-700 line-through' : t.failed ? 'text-slate-400 line-through' : 'text-slate-900'
                          }`}
                        >
                          {t.text}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-400 font-light max-w-md">Noch keine verknüpften Ziele oder Aufgaben.</p>
            )}
          </div>
        </div>
      );
    }

    // Pixeliges Herz, komplett weinrot, transparenter Hintergrund - vier Viertel, je eins pro
    // Lebensbereich; Klick auf ein Viertel führt zu dessen eigener Seite oben.
    const heartWidth = PIXEL_HEART_COLS * PIXEL_HEART_CELL;
    const heartHeight = PIXEL_HEART_ROWS * PIXEL_HEART_CELL;

    return (
      <div className="min-h-screen bg-white p-4 sm:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-start gap-3 sm:gap-6 mb-6 pb-4 sm:mb-12 sm:pb-8 border-b border-slate-200">
            <button
              onClick={() => setSection('hub')}
              className="p-2.5 -ml-2.5 hover:bg-blue-50 rounded transition text-blue-600 hover:text-blue-700"
            >
              <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
            </button>
            <div>
              <h1 className="text-2xl sm:text-4xl font-light text-slate-900 tracking-tight">Lebensbereich</h1>
              <p className="text-sm text-slate-400 font-light mt-1">4 Lebensbereiche</p>
            </div>
          </div>

          <div className="flex justify-center">
            <svg viewBox={`0 0 ${heartWidth} ${heartHeight}`} className="w-[min(80vw,360px)] h-auto">
              {PIXEL_HEART_GRID.map((line, row) =>
                line.map((cell, col) => {
                  if (!cell) return null;
                  const isDivider = col === PIXEL_HEART_COL_DIVIDER || row === PIXEL_HEART_ROW_DIVIDER;
                  return (
                    <rect
                      key={`${row}-${col}`}
                      x={col * PIXEL_HEART_CELL}
                      y={row * PIXEL_HEART_CELL}
                      width={PIXEL_HEART_CELL}
                      height={PIXEL_HEART_CELL}
                      fill={isDivider ? '#ffffff' : '#6d1a35'}
                    />
                  );
                })
              )}
              {LIFE_AREA_QUADRANTS.map((q) => {
                const b = PIXEL_HEART_QUADRANT_BOUNDS[q.quadrant];
                const area = allLifeAreaItems.find(a => a.name === q.name);
                const hitX = b.colStart * PIXEL_HEART_CELL;
                const hitY = b.rowStart * PIXEL_HEART_CELL;
                const hitW = (b.colEnd - b.colStart + 1) * PIXEL_HEART_CELL;
                const hitH = (b.rowEnd - b.rowStart + 1) * PIXEL_HEART_CELL;
                return (
                  <g
                    key={q.name}
                    onClick={() => area && setSelectedLifeAreaId(area.id)}
                    className="cursor-pointer"
                  >
                    <rect x={hitX} y={hitY} width={hitW} height={hitH} fill="transparent" />
                    <text
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="600"
                      fill="#ffffff"
                      fontFamily="'Lora', serif"
                      pointerEvents="none"
                    >
                      {q.lines.map((line, li) => (
                        <tspan key={li} x={q.x} y={q.y + 8 + li * 11}>{line}</tspan>
                      ))}
                    </text>
                    <text
                      x={q.x}
                      y={q.y + 8 + q.lines.length * 11}
                      textAnchor="middle"
                      fontSize="7"
                      fill="#ffffff"
                      opacity="0.85"
                      pointerEvents="none"
                    >
                      Lv. {computeLevelFromXP(area?.xp || 0).level}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>
    );
  }

  // SECTION VIEW (Ziele, Lebensbereiche, Gewohnheiten)
  return (
    <div className="min-h-screen bg-white p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-start gap-3 sm:gap-6 mb-6 pb-4 sm:mb-12 sm:pb-8 border-b border-slate-200">
          <button
            onClick={() => {
              setSection('hub');
              setSelectedGroupId(null);
              setSelectionMode(false);
              setSelectedIds([]);
              setReorderMode(false);
            }}
            className="p-2.5 -ml-2.5 hover:bg-blue-50 rounded transition text-blue-600 hover:text-blue-700"
          >
            <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
          </button>
          <div>
            <h1 className="text-2xl sm:text-4xl font-light text-slate-900 tracking-tight">
              {activeCategory?.label}
            </h1>
            <p className="text-sm text-slate-400 font-light mt-1">
              {section === 'skills'
                ? (() => {
                    const groupCount = itemGroups.filter(g => g.type === skillsTab).length;
                    return `${groupCount} ${groupCount === 1 ? 'Oberkategorie' : 'Oberkategorien'}`;
                  })()
                : `${sectionItems.length} ${sectionItems.length === 1 ? activeCategory?.label : activeCategory?.labelPlural}`}
            </p>
          </div>
        </div>

        {/* Gewohnheiten leben als eigener Tab unter Fähigkeiten */}
        {section === 'skills' && (
          <div className="flex items-center gap-1 mb-6 sm:mb-8 border-b border-slate-200 max-w-sm">
            {SKILLS_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setSkillsTab(tab.id);
                  setSelectedGroupId(null);
                  setSelectionMode(false);
                  setSelectedIds([]);
                  setReorderMode(false);
                }}
                className={`px-3 py-2 text-sm font-light border-b-2 -mb-px transition ${
                  skillsTab === tab.id
                    ? 'text-blue-600 border-blue-600'
                    : 'text-slate-400 border-transparent hover:text-slate-600'
                }`}
              >
                {tab.labelPlural}
              </button>
            ))}
          </div>
        )}

        {section === 'skills' ? (
          renderGroupedSection(
            skillsTab,
            activeCategory?.label,
            activeCategory?.labelPlural,
            'Lvl'
          )
        ) : (
        <>
        {/* Add new */}
        <div className="mb-8 sm:mb-10 max-w-sm">
          {section === 'goals' ? (
            <GoalForm
              virtues={allVirtueItems}
              skills={allSkillItems}
              lifeAreas={allLifeAreaItems}
              virtueGroups={itemGroups.filter(g => g.type === 'principles')}
              skillGroups={itemGroups.filter(g => g.type === 'skills')}
              onCreateVirtue={createAndLinkVirtue}
              onCreateSkill={createAndLinkSkill}
              onSubmit={({ lifeAreaId, learningGoal, title, problem, description, linkedIds, linkedSkillIds }) =>
                addItem(title, linkedIds, { lifeAreaId, learningGoal, description, problem, linkedSkillIds })
              }
            />
          ) : (
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && newItemName.trim()) {
                  addItem(newItemName);
                  setNewItemName('');
                }
              }}
              placeholder={activeCategory?.label}
              className="w-full px-0 py-2 bg-white text-slate-900 border-b border-slate-200 placeholder-slate-400 focus:border-blue-500 outline-none font-light text-base"
            />
          )}
        </div>

        <div className="max-w-md">
          {/* Items list */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-light text-slate-600 tracking-wide uppercase">
                {activeCategory?.labelPlural}
              </h2>
              <div className="flex items-center gap-3">
                {selectionMode && selectedIds.length > 0 && (
                  <button
                    onClick={deleteSelectedItems}
                    className="text-xs text-red-500 hover:text-red-600 font-light transition"
                  >
                    Löschen ({selectedIds.length})
                  </button>
                )}
                <button
                  onClick={() => {
                    setReorderMode(!reorderMode);
                    setSelectionMode(false);
                    setSelectedIds([]);
                  }}
                  className={`text-xs font-light tracking-wide transition ${
                    reorderMode ? 'text-blue-600' : 'text-slate-400 hover:text-blue-600'
                  }`}
                >
                  {reorderMode ? 'Fertig' : 'Neu anordnen'}
                </button>
                <button
                  onClick={() => {
                    setSelectionMode(!selectionMode);
                    setSelectedIds([]);
                    setReorderMode(false);
                  }}
                  className={`text-xs font-light tracking-wide transition ${
                    selectionMode ? 'text-blue-600' : 'text-slate-400 hover:text-blue-600'
                  }`}
                >
                  {selectionMode ? 'Fertig' : 'Auswählen'}
                </button>
              </div>
            </div>

            {reorderMode && (
              <p className="text-xs text-slate-400 font-light -mt-2">Am Griff ziehen, um die Reihenfolge zu ändern</p>
            )}

            <div className="space-y-4">
              {sectionItems.map((item) => (
                <div
                  key={item.id}
                  data-item-id={item.id}
                  className={`group flex items-start gap-3 transition ${
                    selectionMode ? 'cursor-pointer' : ''
                  } ${
                    draggedId === item.id ? 'opacity-40' : 'opacity-100'
                  } ${
                    reorderMode && dragOverId === item.id && draggedId !== item.id
                      ? 'outline outline-2 outline-blue-300 rounded-lg'
                      : ''
                  }`}
                  onClick={() => selectionMode && toggleSelectItem(item.id)}
                >
                  {reorderMode && (
                    <div
                      onPointerDown={(e) => handleDragHandlePointerDown(e, item.id)}
                      onPointerMove={handleDragHandlePointerMove}
                      onPointerUp={handleDragHandlePointerUp}
                      onPointerCancel={handleDragHandlePointerUp}
                      className="mt-0.5 -my-1.5 -ml-1.5 p-1.5 flex-shrink-0 text-slate-400 select-none touch-none cursor-grab active:cursor-grabbing"
                    >
                      ⠿
                    </div>
                  )}
                  {selectionMode && (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleSelectItem(item.id); }}
                      className="mt-0.5 flex-shrink-0"
                    >
                      {selectedIds.includes(item.id) ? (
                        <CheckCircle2 className="w-4 h-4 text-blue-600" strokeWidth={1.5} />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-300" strokeWidth={1.5} />
                      )}
                    </button>
                  )}

                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className={`text-sm font-light ${
                        item.failed ? 'text-slate-400 line-through' : item.completed ? 'text-green-700 line-through' : 'text-slate-900'
                      }`}>{item.name}</h3>
                      {!selectionMode && (
                        <div className="flex items-center gap-1">
                          {section === 'goals' && !item.failed && !item.completed && (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); completeItem(item.id); }}
                                title="Als erfolgreich abgeschlossen markieren"
                                className="p-1.5 -m-1.5 text-slate-300 hover:text-green-600 transition opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                              >
                                <CheckCircle2 className="w-3 h-3" strokeWidth={1.5} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); failItem(item.id); }}
                                title="Als gescheitert markieren"
                                className="p-1.5 -m-1.5 text-slate-300 hover:text-orange-500 transition opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                              >
                                <X className="w-3 h-3" strokeWidth={1.5} />
                              </button>
                            </>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
                            className="p-1.5 -m-1.5 text-slate-300 hover:text-red-500 transition opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                          >
                            <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                          </button>
                        </div>
                      )}
                    </div>

                    {section === 'goals' && allLifeAreaItems.find(a => a.id === item.lifeAreaId) && (
                      <p className="text-xs text-blue-600 font-light mb-1">{allLifeAreaItems.find(a => a.id === item.lifeAreaId).name}</p>
                    )}
                    {section === 'goals' && item.learningGoal && (
                      <p className="text-xs text-slate-500 font-light mb-1 whitespace-pre-wrap">
                        <span className="text-slate-400 uppercase tracking-wide text-[10px] mr-1">Lernen</span>{item.learningGoal}
                      </p>
                    )}
                    {section === 'goals' && item.problem && (
                      <p className="text-xs text-slate-500 font-light mb-1 whitespace-pre-wrap">
                        <span className="text-slate-400 uppercase tracking-wide text-[10px] mr-1">Problem</span>{item.problem}
                      </p>
                    )}
                    {section === 'goals' && item.description && (
                      <p className="text-xs text-slate-500 font-light mb-2 whitespace-pre-wrap">
                        <span className="text-slate-400 uppercase tracking-wide text-[10px] mr-1">Ausgang</span>{item.description}
                      </p>
                    )}
                    {section === 'goals' && (item.linkedItems?.length > 0 || item.linkedSkillIds?.length > 0) && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {(item.linkedItems || []).map(vid => {
                          const v = allVirtueItems.find(vv => vv.id === vid);
                          if (!v) return null;
                          return (
                            <span key={`virtue-${vid}`} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] rounded-full">
                              {v.name}
                            </span>
                          );
                        })}
                        {(item.linkedSkillIds || []).map(sid => {
                          const s = allSkillItems.find(ss => ss.id === sid);
                          if (!s) return null;
                          return (
                            <span key={`skill-${sid}`} className="px-2 py-0.5 bg-violet-50 text-violet-700 text-[10px] rounded-full">
                              {s.name}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {section === 'goals' && (
                      <GoalMilestones
                        goal={item}
                        onAdd={(name) => addMilestone(item.id, name)}
                        onToggle={(milestoneId) => toggleMilestone(item.id, milestoneId)}
                        onDelete={(milestoneId) => deleteMilestone(item.id, milestoneId)}
                      />
                    )}

                    {(() => {
                      const { level, xpInLevel, xpNeeded } = computeLevelFromXP(item.xp || 0);
                      return (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-400">Level</span>
                            <span className="text-sm font-light text-blue-600">{level}{xpNeeded === null ? ' (MAX)' : ''}</span>
                          </div>
                          <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all"
                              style={{ width: `${xpNeeded ? (xpInLevel / xpNeeded) * 100 : 100}%` }}
                            />
                          </div>
                          <p className="text-xs text-slate-400 text-right">
                            {xpNeeded ? `${xpInLevel}/${xpNeeded} XP` : `${item.xp || 0} XP`}
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
