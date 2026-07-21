import React, { useState, useEffect } from 'react';
import { Trash2, Plus, CheckCircle2, Circle, X, ArrowLeft, Heart } from 'lucide-react';

const MAX_HEARTS = 7;
const HEART_LOSS_PER_FAIL = 0.25;

export default function YuYuApp() {
  const [section, setSection] = useState('hub');
  const [items, setItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [newItemName, setNewItemName] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [newTodoText, setNewTodoText] = useState('');
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [reorderMode, setReorderMode] = useState(false);
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [quickTaskText, setQuickTaskText] = useState('');
  const [quickTaskProject, setQuickTaskProject] = useState('');
  const [expandedProjects, setExpandedProjects] = useState({});
  const [newProjectNameTodoist, setNewProjectNameTodoist] = useState('');
  const [showNewProjectInput, setShowNewProjectInput] = useState(false);
  const [virtueGroups, setVirtueGroups] = useState([]);
  const [selectedVirtueGroup, setSelectedVirtueGroup] = useState(null);
  const [newVirtueGroupName, setNewVirtueGroupName] = useState('');
  const [hearts, setHearts] = useState(MAX_HEARTS);

  const categories = [
    { id: 'goals', label: 'Ziel', labelPlural: 'Ziele', startAngle: 0, endAngle: 90 },
    { id: 'life-areas', label: 'Lebensbereich', labelPlural: 'Lebensbereiche', startAngle: 90, endAngle: 180 },
    { id: 'habits', label: 'Gewohnheit', labelPlural: 'Gewohnheiten', startAngle: 180, endAngle: 270 },
    { id: 'todos', label: 'Aufgabe', labelPlural: 'Aufgaben', startAngle: 270, endAngle: 360 }
  ];

  const allCategories = [...categories, { id: 'principles', label: 'Tugend', labelPlural: 'Tugenden' }];
  const currentCategory = allCategories.find(c => c.id === section);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    saveData();
  }, [items, projects, virtueGroups, hearts]);

  const loadData = () => {
    try {
      const saved = localStorage.getItem('yuyu-items');
      if (saved) setItems(JSON.parse(saved));
      const projectsSaved = localStorage.getItem('yuyu-projects');
      if (projectsSaved) setProjects(JSON.parse(projectsSaved));
      const virtueGroupsSaved = localStorage.getItem('yuyu-virtue-groups');
      if (virtueGroupsSaved) setVirtueGroups(JSON.parse(virtueGroupsSaved));
      const heartsSaved = localStorage.getItem('yuyu-hearts');
      if (heartsSaved !== null) setHearts(JSON.parse(heartsSaved));
    } catch (err) {
      console.error('Konnte gespeicherte Daten nicht laden:', err);
    }
  };

  const saveData = () => {
    localStorage.setItem('yuyu-items', JSON.stringify(items));
    localStorage.setItem('yuyu-projects', JSON.stringify(projects));
    localStorage.setItem('yuyu-virtue-groups', JSON.stringify(virtueGroups));
    localStorage.setItem('yuyu-hearts', JSON.stringify(hearts));
  };

  const addItem = () => {
    if (!newItemName.trim()) return;
    const newItem = {
      id: Date.now(),
      type: section,
      name: newItemName,
      level: 0,
      experience: 0,
      maxExperience: 100,
      createdAt: new Date().toISOString(),
    };
    if (section === 'principles' && selectedVirtueGroup) {
      newItem.groupId = selectedVirtueGroup;
    }
    setItems([...items, newItem]);
    setNewItemName('');
  };

  // Tugend-Oberkategorien (z.B. "Old Money") gruppieren einzelne Tugenden
  const addVirtueGroup = () => {
    if (!newVirtueGroupName.trim()) return;
    setVirtueGroups([...virtueGroups, {
      id: Date.now(),
      name: newVirtueGroupName,
      createdAt: new Date().toISOString(),
    }]);
    setNewVirtueGroupName('');
  };

  const deleteVirtueGroup = (id) => {
    setVirtueGroups(virtueGroups.filter(g => g.id !== id));
    // Tugenden bleiben erhalten, werden aber wieder zu "ohne Kategorie"
    setItems(items.map(i => (i.groupId === id ? { ...i, groupId: undefined } : i)));
    if (selectedVirtueGroup === id) setSelectedVirtueGroup(null);
  };

  const loseHeart = () => {
    setHearts(prev => Math.max(0, Math.round((prev - HEART_LOSS_PER_FAIL) * 100) / 100));
  };

  const addProject = () => {
    if (!newProjectName.trim()) return;
    setProjects([...projects, {
      id: Date.now(),
      name: newProjectName,
      todos: [],
      linkedItems: [],
      duration: '5 Days'
    }]);
    setNewProjectName('');
  };

  const addTodo = (projectId) => {
    if (!newTodoText.trim()) return;
    setProjects(projects.map(p => {
      if (p.id === projectId) {
        return {
          ...p,
          todos: [...p.todos, {
            id: Date.now(),
            text: newTodoText,
            completed: false,
            linkedItems: []
          }]
        };
      }
      return p;
    }));
    setNewTodoText('');
  };

  // Todoist-Style: Quick-add zu einem Projekt (Inbox falls keins existiert)
  const getOrCreateInbox = () => {
    let inbox = projects.find(p => p.isInbox);
    if (!inbox) {
      inbox = { id: Date.now(), name: 'Inbox', todos: [], linkedItems: [], duration: '', isInbox: true };
      setProjects(prev => [inbox, ...prev]);
    }
    return inbox;
  };

  const quickAddTask = (text, targetProjectId) => {
    if (!text.trim()) return;
    setProjects(prev => {
      let list = prev;
      let projectId = targetProjectId;
      if (!projectId) {
        let inbox = list.find(p => p.isInbox);
        if (!inbox) {
          inbox = { id: Date.now(), name: 'Inbox', todos: [], linkedItems: [], duration: '', isInbox: true };
          list = [inbox, ...list];
        }
        projectId = inbox.id;
      }
      return list.map(p => {
        if (p.id === projectId) {
          return { ...p, todos: [...p.todos, { id: Date.now(), text, completed: false, linkedItems: [] }] };
        }
        return p;
      });
    });
  };

  const toggleTodo = (projectId, todoId) => {
    setProjects(projects.map(p => {
      if (p.id === projectId) {
        return {
          ...p,
          todos: p.todos.map(t => {
            if (t.id === todoId && !t.completed) {
              gainExperience(t.linkedItems || [], 15);
              return { ...t, completed: true };
            }
            return t;
          })
        };
      }
      return p;
    }));
  };

  // Aufgabe als gescheitert markieren: kostet ein Viertel-Herz
  const failTodo = (projectId, todoId) => {
    const project = projects.find(p => p.id === projectId);
    const todo = project?.todos.find(t => t.id === todoId);
    if (!todo || todo.completed || todo.failed) return;
    setProjects(projects.map(p => {
      if (p.id === projectId) {
        return {
          ...p,
          todos: p.todos.map(t => (t.id === todoId ? { ...t, failed: true } : t))
        };
      }
      return p;
    }));
    loseHeart();
  };

  const gainExperience = (itemIds, amount) => {
    setItems(items.map(item => {
      if (itemIds.includes(item.id)) {
        let exp = item.experience + amount;
        let level = item.level;

        while (exp >= item.maxExperience) {
          exp -= item.maxExperience;
          level += 1;
        }

        return { ...item, experience: exp, level };
      }
      return item;
    }));
  };

  const deleteItem = (id) => {
    setItems(items.filter(i => i.id !== id));
  };

  // Ziel als gescheitert markieren: kostet ein Viertel-Herz
  const failItem = (id) => {
    const item = items.find(i => i.id === id);
    if (!item || item.failed) return;
    setItems(items.map(i => (i.id === id ? { ...i, failed: true } : i)));
    loseHeart();
  };

  const toggleSelectItem = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const deleteSelectedItems = () => {
    setItems(items.filter(i => !selectedIds.includes(i.id)));
    setSelectedIds([]);
    setSelectionMode(false);
  };

  // Welche Items gerade sichtbar/sortierbar sind: bei Tugenden zusätzlich nach Oberkategorie gefiltert
  const itemInScope = (i) => {
    if (section !== 'principles') return i.type === section;
    return i.type === 'principles' && (selectedVirtueGroup ? i.groupId === selectedVirtueGroup : !i.groupId);
  };

  // Tugend per Drag & Drop an neue Position im Ranking der Kategorie verschieben
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
      return [...otherType, ...reordered];
    });
  };

  const deleteProject = (id) => {
    setProjects(projects.filter(p => p.id !== id));
    if (selectedProject === id) setSelectedProject(null);
  };

  const deleteTodo = (projectId, todoId) => {
    setProjects(projects.map(p => {
      if (p.id === projectId) {
        return { ...p, todos: p.todos.filter(t => t.id !== todoId) };
      }
      return p;
    }));
  };

  const toggleItemLink = (projectId, todoId, itemId) => {
    setProjects(projects.map(p => {
      if (p.id === projectId) {
        return {
          ...p,
          todos: p.todos.map(t => {
            if (t.id === todoId) {
              const linked = t.linkedItems || [];
              if (linked.includes(itemId)) {
                return { ...t, linkedItems: linked.filter(id => id !== itemId) };
              } else {
                return { ...t, linkedItems: [...linked, itemId] };
              }
            }
            return t;
          })
        };
      }
      return p;
    }));
  };

  const sectionItems = items.filter(itemInScope);
  const currentVirtueGroup = virtueGroups.find(g => g.id === selectedVirtueGroup);

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

  // HUB VIEW
  if (section === 'hub') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 sm:p-6">
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

              return (
                <g key={cat.id}>
                  <path
                    d={describeArc(cat.startAngle, cat.endAngle, outerRadius)}
                    fill="#ffffff"
                    stroke="#e5e7eb"
                    strokeWidth="0.5"
                    className="hover:fill-slate-50 transition-colors cursor-pointer"
                    onClick={() => setSection(cat.id)}
                    style={{ opacity: 0.8 }}
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

            {/* Center circle - clickable für Prinzipien */}
            <circle cx="250" cy="250" r="140" fill="white" stroke="#7c9fd6" strokeWidth="1.5" onClick={() => { setSelectedVirtueGroup(null); setSection('principles'); }} className="cursor-pointer hover:fill-slate-50 transition" />
            <circle cx="250" cy="250" r="135" fill="#f8fafc" onClick={() => { setSelectedVirtueGroup(null); setSection('principles'); }} className="cursor-pointer hover:fill-slate-50 transition" />

            {/* Center text - schwarz */}
            <text x="250" y="245" textAnchor="middle" dy="0.3em" fill="#000000" fontSize="14" fontWeight="300" pointerEvents="none" letterSpacing="2">
              Tugend
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
      </div>
    );
  }

  // TODOIST-STYLE VIEW für Aufgaben
  if (section === 'todos') {
    const toggleExpand = (projectId) => {
      setExpandedProjects(prev => ({ ...prev, [projectId]: !prev[projectId] }));
    };

    const addTodoistProject = () => {
      if (!newProjectNameTodoist.trim()) return;
      setProjects([...projects, {
        id: Date.now(),
        name: newProjectNameTodoist,
        todos: [],
        linkedItems: [],
        duration: ''
      }]);
      setNewProjectNameTodoist('');
      setShowNewProjectInput(false);
    };

    const allTasksCount = projects.reduce((sum, p) => sum + p.todos.filter(t => !t.completed && !t.failed).length, 0);

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
              <p className="text-xs text-slate-400 font-light mt-0.5">{allTasksCount} offen</p>
            </div>
          </div>

          {/* Quick Add - Todoist Style */}
          <div className="flex items-center gap-3 mb-6 sm:mb-8 border border-slate-200 rounded-lg px-4 py-3 focus-within:border-blue-400 transition">
            <Plus className="w-5 h-5 text-blue-500 flex-shrink-0" strokeWidth={1.5} />
            <input
              type="text"
              value={quickTaskText}
              onChange={(e) => setQuickTaskText(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && quickTaskText.trim()) {
                  quickAddTask(quickTaskText, quickTaskProject || null);
                  setQuickTaskText('');
                }
              }}
              placeholder="Aufgabe hinzufügen..."
              className="flex-1 min-w-0 outline-none text-base sm:text-sm font-light text-slate-900 placeholder-slate-400"
            />
            {projects.length > 0 && (
              <select
                value={quickTaskProject}
                onChange={(e) => setQuickTaskProject(e.target.value)}
                className="text-xs text-slate-500 bg-slate-50 rounded px-2 py-1 outline-none border border-slate-200"
              >
                <option value="">Inbox</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Projekte mit Aufgaben - Todoist Style Liste */}
          <div className="space-y-1">
            {projects.length === 0 ? (
              <p className="text-slate-400 text-sm font-light text-center py-12">Noch keine Aufgaben — leg los ✍️</p>
            ) : (
              projects.map(project => {
                const openTodos = project.todos.filter(t => !t.completed && !t.failed);
                const doneTodos = project.todos.filter(t => t.completed);
                const failedTodos = project.todos.filter(t => t.failed);
                const isExpanded = expandedProjects[project.id] !== false; // default open

                return (
                  <div key={project.id} className="border-b border-slate-100 py-3">
                    {/* Projekt-Header */}
                    <div className="flex items-center justify-between mb-2 group">
                      <button
                        onClick={() => toggleExpand(project.id)}
                        className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition"
                      >
                        <span className={`inline-block transition-transform text-blue-400 ${isExpanded ? 'rotate-90' : ''}`}>▸</span>
                        {project.name}
                        <span className="text-xs text-slate-400 font-light">{openTodos.length}</span>
                      </button>
                      {!project.isInbox && (
                        <button
                          onClick={() => deleteProject(project.id)}
                          className="p-1.5 -m-1.5 text-slate-300 hover:text-red-400 transition opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                        </button>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="space-y-0.5 ml-1">
                        {/* Inline add task innerhalb des Projekts */}
                        <div className="flex items-center gap-3 py-1.5 px-1">
                          <Circle className="w-4 h-4 text-slate-200 flex-shrink-0" strokeWidth={1.5} />
                          <input
                            type="text"
                            value={selectedProject === project.id ? newTodoText : ''}
                            onFocus={() => setSelectedProject(project.id)}
                            onChange={(e) => setNewTodoText(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && addTodo(project.id)}
                            placeholder="+ Aufgabe hinzufügen"
                            className="flex-1 min-w-0 text-base sm:text-sm font-light text-slate-400 placeholder-slate-300 outline-none focus:text-slate-900"
                          />
                        </div>

                        {/* Offene Aufgaben */}
                        {openTodos.map(todo => (
                          <div key={todo.id} className="flex items-center gap-3 py-1.5 px-1 group/task hover:bg-slate-50 rounded transition">
                            <button
                              onClick={() => toggleTodo(project.id, todo.id)}
                              className="text-slate-300 hover:text-blue-500 transition flex-shrink-0"
                            >
                              <Circle className="w-4 h-4" strokeWidth={1.5} />
                            </button>
                            <span className="flex-1 text-sm font-light text-slate-900">{todo.text}</span>
                            <button
                              onClick={() => failTodo(project.id, todo.id)}
                              title="Als gescheitert markieren"
                              className="p-1.5 -m-1.5 text-slate-300 hover:text-orange-500 transition opacity-100 sm:opacity-0 sm:group-hover/task:opacity-100 flex-shrink-0"
                            >
                              <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                            </button>
                            <button
                              onClick={() => deleteTodo(project.id, todo.id)}
                              className="p-1.5 -m-1.5 text-slate-300 hover:text-red-400 transition opacity-100 sm:opacity-0 sm:group-hover/task:opacity-100 flex-shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                            </button>
                          </div>
                        ))}

                        {/* Gescheiterte Aufgaben */}
                        {failedTodos.length > 0 && (
                          <div className="pt-1">
                            {failedTodos.map(todo => (
                              <div key={todo.id} className="flex items-center gap-3 py-1.5 px-1 group/task">
                                <X className="w-4 h-4 text-orange-400 flex-shrink-0" strokeWidth={1.5} />
                                <span className="flex-1 text-sm font-light text-slate-400 line-through">{todo.text}</span>
                                <button
                                  onClick={() => deleteTodo(project.id, todo.id)}
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
                                  onClick={() => deleteTodo(project.id, todo.id)}
                                  className="p-1.5 -m-1.5 text-slate-300 hover:text-red-400 transition opacity-100 sm:opacity-0 sm:group-hover/task:opacity-100 flex-shrink-0"
                                >
                                  <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Neues Projekt hinzufügen */}
          <div className="mt-8 pt-4">
            {showNewProjectInput ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newProjectNameTodoist}
                  onChange={(e) => setNewProjectNameTodoist(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addTodoistProject()}
                  placeholder="Projektname..."
                  autoFocus
                  className="flex-1 min-w-0 px-0 py-2 bg-white text-slate-900 border-b border-slate-200 placeholder-slate-300 focus:border-blue-500 outline-none font-light text-base sm:text-sm"
                />
                <button onClick={addTodoistProject} className="text-sm text-blue-600 hover:text-blue-700 font-light">
                  Add
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNewProjectInput(true)}
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-blue-600 transition font-light"
              >
                <Plus className="w-4 h-4" strokeWidth={1.5} /> Projekt hinzufügen
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // SECTION VIEW
  return (
    <div className="min-h-screen bg-white p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-start gap-3 sm:gap-6 mb-6 pb-4 sm:mb-12 sm:pb-8 border-b border-slate-200">
          <button
            onClick={() => {
              if (section === 'principles' && selectedVirtueGroup) {
                setSelectedVirtueGroup(null);
              } else {
                setSection('hub');
              }
            }}
            className="p-2.5 -ml-2.5 hover:bg-blue-50 rounded transition text-blue-600 hover:text-blue-700"
          >
            <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
          </button>
          <div>
            <h1 className="text-2xl sm:text-4xl font-light text-slate-900 tracking-tight">
              {section === 'principles' && currentVirtueGroup ? currentVirtueGroup.name : currentCategory?.label}
            </h1>
            <p className="text-sm text-slate-400 font-light mt-1">{sectionItems.length} {sectionItems.length === 1 ? currentCategory?.label : currentCategory?.labelPlural}</p>

            {/* Herzen: character-weite Lebensanzeige, oben auf der Tugend-Hauptseite */}
            {section === 'principles' && !selectedVirtueGroup && (
              <div className="mt-3">
                <div className="flex gap-0.5 sm:gap-1">{renderHearts()}</div>
                <p className="text-[10px] sm:text-xs text-slate-400 font-light mt-1">{Number(hearts.toFixed(2))} / {MAX_HEARTS} Herzen</p>
              </div>
            )}
          </div>
        </div>

        {/* Tugend-Oberkategorien: eigene Gruppen, in die man Tugenden einsortieren kann */}
        {section === 'principles' && !selectedVirtueGroup && (
          <div className="mb-8 sm:mb-10">
            <div className="flex items-center gap-2 max-w-sm mb-4">
              <input
                type="text"
                value={newVirtueGroupName}
                onChange={(e) => setNewVirtueGroupName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addVirtueGroup()}
                placeholder="Neue Oberkategorie (z.B. Old Money)"
                className="flex-1 min-w-0 px-0 py-2 bg-white text-slate-900 border-b border-slate-200 placeholder-slate-400 focus:border-blue-500 outline-none font-light text-base"
              />
              <button onClick={addVirtueGroup} className="text-sm text-blue-600 hover:text-blue-700 font-light flex-shrink-0">
                Add
              </button>
            </div>
            {virtueGroups.length > 0 && (
              <div className="space-y-2 max-w-sm">
                {virtueGroups.map(group => {
                  const groupItemCount = items.filter(i => i.type === 'principles' && i.groupId === group.id).length;
                  return (
                    <div
                      key={group.id}
                      onClick={() => setSelectedVirtueGroup(group.id)}
                      className="group/vgroup flex items-center justify-between border border-slate-200 rounded-lg px-4 py-3 cursor-pointer hover:border-blue-300 transition"
                    >
                      <div>
                        <h3 className="text-sm text-slate-900 font-medium">{group.name}</h3>
                        <p className="text-xs text-slate-400 font-light">{groupItemCount} {groupItemCount === 1 ? 'Tugend' : 'Tugenden'}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteVirtueGroup(group.id); }}
                        className="p-1.5 -m-1.5 text-slate-300 hover:text-red-500 transition opacity-100 sm:opacity-0 sm:group-hover/vgroup:opacity-100 flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {section === 'principles' && !selectedVirtueGroup && virtueGroups.length > 0 && (
          <h2 className="text-sm font-light text-slate-600 tracking-wide uppercase mb-4">Ohne Kategorie</h2>
        )}

        {/* Add new - ganz oben */}
        <div className="mb-8 sm:mb-10">
          <input
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addItem()}
            placeholder={currentCategory?.label}
            className="w-full px-0 py-2 bg-white text-slate-900 border-b border-slate-200 placeholder-slate-400 focus:border-blue-500 outline-none font-light text-base max-w-sm"
          />
        </div>

        {/* Puzzle-Piece Visualisierung - nur für Tugenden, direkt sichtbar */}
        {section === 'principles' && sectionItems.length > 0 && (
          <div className="mb-8 pb-6 sm:mb-12 sm:pb-8 border-b border-slate-100">
            <h2 className="text-sm font-light text-slate-600 tracking-wide uppercase mb-6 sm:mb-8 text-center">
              Deine Tugenden fügen sich zusammen
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
                              Lv. {item.level}
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

        <div className="max-w-md">
          {/* Items list */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-light text-slate-600 tracking-wide uppercase">
                {currentCategory?.labelPlural}
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
                      <h3 className={`text-sm font-light ${item.failed ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{item.name}</h3>
                      {!selectionMode && (
                        <div className="flex items-center gap-1">
                          {section === 'goals' && !item.failed && (
                            <button
                              onClick={(e) => { e.stopPropagation(); failItem(item.id); }}
                              title="Als gescheitert markieren"
                              className="p-1.5 -m-1.5 text-slate-300 hover:text-orange-500 transition opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                            >
                              <X className="w-3 h-3" strokeWidth={1.5} />
                            </button>
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

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-400">Level</span>
                        <span className="text-sm font-light text-blue-600">{item.level}</span>
                      </div>
                      <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all"
                          style={{ width: `${(item.experience / item.maxExperience) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-400 text-right">{item.experience}/{item.maxExperience}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
