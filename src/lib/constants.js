export const MAX_HEARTS = 7;
export const HEART_LOSS_PER_FAIL = 0.25;

// Oberkategorien gelten für diese drei Typen - Items dieser Typen sind nur innerhalb einer
// offenen Oberkategorie sichtbar/anlegbar (wie bisher schon bei Tugenden).
export const GROUPED_TYPES = ['principles', 'habits', 'skills'];
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
export const migrateItemXP = (item) => {
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
export const FIXED_LIFE_AREAS = ['Persönlich', 'Familie & Freunde', 'Arbeit', 'Gemeinde'];
export const LIFE_AREA_XP_PER_COMPLETION = 10;
// Fähigkeiten, Tugenden und Gewohnheiten laufen mit dem gleichen XP-Zuwachs pro Erledigung wie Lebensbereiche
export const SKILL_XP_PER_COMPLETION = 10;
export const VIRTUE_XP_PER_COMPLETION = 10;
export const HABIT_XP_PER_COMPLETION = 10;

export const GOAL_TITLE_MAX_LENGTH = 60;
