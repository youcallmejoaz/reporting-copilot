export const fmtMoney = (x: number | null, digits = 0) =>
  x === null ? "–" : `$${x.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
export const fmtNum = (x: number | null) => (x === null ? "–" : x.toLocaleString("en-US"));
export const fmtRoas = (x: number | null) => (x === null ? "–" : x.toFixed(2));
export const fmtPct = (x: number | null, digits = 1) => (x === null ? "–" : `${x > 0 ? "+" : ""}${x.toFixed(digits)}%`);
