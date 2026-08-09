// Pixeliges 8-Bit-Herz: Rastergröße füllen, indem pro Zelle die klassische Herz-Formel
// (x²+y²-1)³ - x²y³ <= 0 ausgewertet wird - ergibt automatisch die gestufte Pixel-Silhouette.
export const PIXEL_HEART_COLS = 20;
export const PIXEL_HEART_ROWS = 18;
export const PIXEL_HEART_CELL = 10;

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
export const PIXEL_HEART_COL_DIVIDER = Math.floor(PIXEL_HEART_COLS / 2);
export const PIXEL_HEART_ROW_DIVIDER = Math.floor(PIXEL_HEART_ROWS / 2) - 1;
export const PIXEL_HEART_QUADRANT_BOUNDS = {
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

export { PIXEL_HEART_GRID };

export const LIFE_AREA_QUADRANTS = [
  { name: 'Persönlich', lines: ['Persönlich'], quadrant: 'tl' },
  { name: 'Familie & Freunde', lines: ['Familie &', 'Freunde'], quadrant: 'tr' },
  { name: 'Arbeit', lines: ['Arbeit'], quadrant: 'bl' },
  { name: 'Gemeinde', lines: ['Gemeinde'], quadrant: 'br' },
].map(q => ({ ...q, ...computeFilledCenter(PIXEL_HEART_QUADRANT_BOUNDS[q.quadrant]) }));
