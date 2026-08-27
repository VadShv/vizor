// Ядро анализа данных: парсинг файлов, профилирование колонок, агрегации

import Papa from "papaparse";

export type ColumnType = "numeric" | "date" | "categorical" | "text";

export interface ColumnProfile {
  name: string;
  type: ColumnType;
  uniqueCount: number;
  missingCount: number;
  isId: boolean;
  // numeric stats
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  sum?: number;
  // date range
  dateMin?: Date;
  dateMax?: Date;
}

export interface Dataset {
  name: string;
  rows: Record<string, unknown>[];
  columns: ColumnProfile[];
}

// ---------- Value parsing ----------

const NUM_RE = /^-?[\d\s\u00a0.,]+%?$/;

export function toNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  if (v instanceof Date) return null;
  let s = String(v).trim().replace(/[₽$€£\s\u00a0]/g, "");
  if (s === "" || !NUM_RE.test(String(v).trim().replace(/[₽$€£]/g, ""))) return null;
  s = s.replace(/%$/, "");
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // последний разделитель — десятичный
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (hasComma) {
    const parts = s.split(",");
    if (parts.length === 2 && parts[1].length !== 3) s = s.replace(",", ".");
    else if (parts.length === 2) s = s.replace(",", "."); // считаем десятичной
    else s = s.replace(/,/g, "");
  }
  const n = Number(s);
  return isFinite(n) ? n : null;
}

const DMY_RE = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/;
const ISO_RE = /^(\d{4})-(\d{1,2})-(\d{1,2})([T\s].*)?$/;

export function toDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") return null;
  const s = String(v).trim();
  let m = ISO_RE.exec(s);
  if (m) {
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return isNaN(d.getTime()) ? null : d;
  }
  m = DMY_RE.exec(s);
  if (m) {
    let year = +m[3];
    if (year < 100) year += year > 50 ? 1900 : 2000;
    const day = +m[1];
    const month = +m[2];
    if (month > 12 && day <= 12) {
      const d = new Date(year, day - 1, month);
      return isNaN(d.getTime()) ? null : d;
    }
    if (month <= 12 && day <= 31) {
      const d = new Date(year, month - 1, day);
      return isNaN(d.getTime()) ? null : d;
    }
  }
  return null;
}

// ---------- Profiling ----------

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
}

export function profileColumns(rows: Record<string, unknown>[]): ColumnProfile[] {
  if (!rows.length) return [];
  const names = Object.keys(rows[0]);
  return names.map((name) => {
    const values = rows.map((r) => r[name]);
    const nonEmpty = values.filter((v) => v != null && String(v).trim() !== "");
    const missingCount = values.length - nonEmpty.length;
    const uniq = new Set(nonEmpty.map((v) => String(v)));
    const uniqueCount = uniq.size;

    let numCount = 0;
    let dateCount = 0;
    const nums: number[] = [];
    const dates: number[] = [];
    for (const v of nonEmpty) {
      const n = toNumber(v);
      if (n !== null) {
        numCount++;
        nums.push(n);
      }
      const d = toDate(v);
      if (d !== null) {
        dateCount++;
        dates.push(d.getTime());
      }
    }

    const total = nonEmpty.length || 1;
    let type: ColumnType;
    if (dateCount / total >= 0.85 && dateCount > 0) type = "date";
    else if (numCount / total >= 0.85 && numCount > 0) type = "numeric";
    else if (uniqueCount <= 30 || (uniqueCount / total <= 0.5 && uniqueCount <= 60)) type = "categorical";
    else type = "text";

    const isId =
      (/(^|[\s_])(id|№|номер|code|код|артикул|sku)([\s_]|$)/i.test(name) && uniqueCount >= total * 0.9) ||
      (type === "numeric" && uniqueCount === total && /id|№|номер/i.test(name));

    const p: ColumnProfile = { name, type, uniqueCount, missingCount, isId };
    if (type === "numeric" && nums.length) {
      const sorted = [...nums].sort((a, b) => a - b);
      p.min = sorted[0];
      p.max = sorted[sorted.length - 1];
      p.sum = nums.reduce((a, b) => a + b, 0);
      p.mean = p.sum / nums.length;
      p.median = quantile(sorted, 0.5);
    }
    if (type === "date" && dates.length) {
      p.dateMin = new Date(Math.min(...dates));
      p.dateMax = new Date(Math.max(...dates));
    }
    return p;
  });
}

// ---------- Aggregations ----------

export type AggFn = "sum" | "avg" | "count" | "max" | "min";

export const AGG_LABELS: Record<AggFn, string> = {
  sum: "Сумма",
  avg: "Среднее",
  count: "Количество",
  max: "Максимум",
  min: "Минимум",
};

function applyAgg(values: number[], agg: AggFn, count: number): number {
  if (agg === "count") return count;
  if (!values.length) return 0;
  switch (agg) {
    case "sum":
      return values.reduce((a, b) => a + b, 0);
    case "avg":
      return values.reduce((a, b) => a + b, 0) / values.length;
    case "max":
      return Math.max(...values);
    case "min":
      return Math.min(...values);
    default:
      return 0;
  }
}

export interface GroupResult {
  label: string;
  value: number;
}

export function groupBy(
  rows: Record<string, unknown>[],
  dim: string,
  metric: string | null,
  agg: AggFn,
  topN = 10,
): GroupResult[] {
  const groups = new Map<string, { nums: number[]; count: number }>();
  for (const r of rows) {
    const key = String(r[dim] ?? "").trim() || "(пусто)";
    let g = groups.get(key);
    if (!g) {
      g = { nums: [], count: 0 };
      groups.set(key, g);
    }
    g.count++;
    if (metric) {
      const n = toNumber(r[metric]);
      if (n !== null) g.nums.push(n);
    }
  }
  const out: GroupResult[] = [];
  groups.forEach((g, label) => {
    out.push({ label, value: applyAgg(g.nums, metric ? agg : "count", g.count) });
  });
  out.sort((a, b) => b.value - a.value);
  if (out.length > topN) {
    const rest = out.slice(topN - 1);
    const restSum = rest.reduce((a, b) => a + b.value, 0);
    return [...out.slice(0, topN - 1), { label: "Прочее", value: restSum }];
  }
  return out;
}

export type TimeGrain = "day" | "week" | "month" | "year";

export function timeSeries(
  rows: Record<string, unknown>[],
  dateCol: string,
  metric: string | null,
  agg: AggFn,
): { data: { t: number; label: string; value: number }[]; grain: TimeGrain } {
  const points: { d: Date; n: number | null }[] = [];
  for (const r of rows) {
    const d = toDate(r[dateCol]);
    if (!d) continue;
    points.push({ d, n: metric ? toNumber(r[metric]) : null });
  }
  if (!points.length) return { data: [], grain: "month" };
  const min = Math.min(...points.map((p) => p.d.getTime()));
  const max = Math.max(...points.map((p) => p.d.getTime()));
  const spanDays = (max - min) / 86400000;
  const grain: TimeGrain = spanDays <= 62 ? "day" : spanDays <= 730 ? "month" : "year";

  const keyOf = (d: Date): number => {
    if (grain === "day") return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    if (grain === "month") return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    return new Date(d.getFullYear(), 0, 1).getTime();
  };

  const groups = new Map<number, { nums: number[]; count: number }>();
  for (const p of points) {
    const k = keyOf(p.d);
    let g = groups.get(k);
    if (!g) {
      g = { nums: [], count: 0 };
      groups.set(k, g);
    }
    g.count++;
    if (p.n !== null) g.nums.push(p.n);
  }

  const fmt = new Intl.DateTimeFormat(
    "ru-RU",
    grain === "day"
      ? { day: "numeric", month: "short" }
      : grain === "month"
        ? { month: "short", year: "2-digit" }
        : { year: "numeric" },
  );

  const data = Array.from(groups.entries())
    .map(([t, g]) => ({
      t,
      label: fmt.format(new Date(t)),
      value: applyAgg(g.nums, metric ? agg : "count", g.count),
    }))
    .sort((a, b) => a.t - b.t);
  return { data, grain };
}

export function histogram(rows: Record<string, unknown>[], col: string, binCount = 12): GroupResult[] {
  const nums: number[] = [];
  for (const r of rows) {
    const n = toNumber(r[col]);
    if (n !== null) nums.push(n);
  }
  if (nums.length < 2) return [];
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (min === max) return [{ label: formatNumber(min), value: nums.length }];
  const width = (max - min) / binCount;
  const bins = new Array(binCount).fill(0);
  for (const n of nums) {
    let idx = Math.floor((n - min) / width);
    if (idx >= binCount) idx = binCount - 1;
    bins[idx]++;
  }
  return bins.map((count, i) => ({
    label: `${formatNumber(min + i * width)}–${formatNumber(min + (i + 1) * width)}`,
    value: count,
  }));
}

export function scatterData(
  rows: Record<string, unknown>[],
  xCol: string,
  yCol: string,
  maxPoints = 500,
): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (const r of rows) {
    const x = toNumber(r[xCol]);
    const y = toNumber(r[yCol]);
    if (x !== null && y !== null) pts.push({ x, y });
  }
  if (pts.length <= maxPoints) return pts;
  const step = pts.length / maxPoints;
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < pts.length; i += step) out.push(pts[Math.floor(i)]);
  return out;
}

export function correlation(rows: Record<string, unknown>[], a: string, b: string): number | null {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const r of rows) {
    const x = toNumber(r[a]);
    const y = toNumber(r[b]);
    if (x !== null && y !== null) {
      xs.push(x);
      ys.push(y);
    }
  }
  const n = xs.length;
  if (n < 5) return null;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let cov = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < n; i++) {
    cov += (xs[i] - mx) * (ys[i] - my);
    vx += (xs[i] - mx) ** 2;
    vy += (ys[i] - my) ** 2;
  }
  if (vx === 0 || vy === 0) return null;
  return cov / Math.sqrt(vx * vy);
}

// ---------- Formatting ----------

export function formatNumber(n: number): string {
  if (!isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toLocaleString("ru-RU", { maximumFractionDigits: 1 }) + " млрд";
  if (abs >= 1e6) return (n / 1e6).toLocaleString("ru-RU", { maximumFractionDigits: 1 }) + " млн";
  if (abs >= 1e4) return (n / 1e3).toLocaleString("ru-RU", { maximumFractionDigits: 1 }) + " тыс";
  if (abs >= 100) return n.toLocaleString("ru-RU", { maximumFractionDigits: 0 });
  if (Number.isInteger(n)) return n.toLocaleString("ru-RU");
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

// ---------- File parsing ----------

function decodeCsvBuffer(buf: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  // если много символов замены — вероятно windows-1251
  const badCount = (utf8.match(/\uFFFD/g) || []).length;
  if (badCount > utf8.length * 0.001) {
    try {
      return new TextDecoder("windows-1251").decode(buf);
    } catch {
      return utf8;
    }
  }
  return utf8;
}

export async function parseFile(file: File): Promise<Dataset> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  const buf = await file.arrayBuffer();
  let rows: Record<string, unknown>[] = [];

  if (ext === "xlsx" || ext === "xls") {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(buf, { cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  } else {
    const text = decodeCsvBuffer(buf);
    const result = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
    });
    rows = result.data;
  }

  // отбрасываем полностью пустые строки и служебные колонки
  rows = rows.filter((r) => Object.values(r).some((v) => v != null && String(v).trim() !== ""));
  if (!rows.length) throw new Error("Файл не содержит данных");
  if (rows.length > 100000) rows = rows.slice(0, 100000);

  const columns = profileColumns(rows);
  return { name: file.name, rows, columns };
}
