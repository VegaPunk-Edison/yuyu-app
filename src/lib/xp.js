// Level-Formel von PIFA übernommen (dort: computeAttrLevel/xpForLevel in Dashboard.js) - jedes
// Level braucht kumulativ mehr XP als das vorherige, Cap bei Level 10 ("MAX", wie in PIFA).
// Gilt einheitlich für alles, was in YuYu levelt: Lebensbereiche, Gewohnheiten, Fähigkeiten, Tugenden.
const XP_LEVEL_CAP = 10;

export const xpForLevel = (level) => Math.round(100 * Math.pow(1.8, level));

export const computeLevelFromXP = (totalXp) => {
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
