export const loadJSON = (key, fallback) => {
  try {
    const saved = localStorage.getItem(key);
    return saved !== null ? JSON.parse(saved) : fallback;
  } catch (err) {
    console.error(`Konnte "${key}" nicht laden:`, err);
    return fallback;
  }
};
