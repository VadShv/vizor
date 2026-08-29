import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
  Line,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
  ComposedChart,
  ReferenceLine,
  LabelList,
} from "recharts";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dataset,
  AggFn,
  AGG_LABELS,
  groupBy,
  timeSeries,
  histogram,
  scatterData,
  correlation,
  formatNumber,
  detectAnomalies,
  forecastLinear,
  rankWithTrend,
  pareto,
  toNumber,
  type RankItem,
} from "@/lib/dataEngine";

export const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-6))",
];

const tooltipStyle: React.CSSProperties = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--popover-border))",
  borderRadius: "10px",
  fontSize: "12px",
  color: "hsl(var(--popover-foreground))",
  fontFamily: "'JetBrains Mono', monospace",
  boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
  padding: "8px 12px",
};

const axisTick = { fontSize: 11, fill: "hsl(var(--muted-foreground))" };

// ---------- Sparkline (SVG, для KPI-карточек) ----------

export function Sparkline({ data, color, width = 100, height = 32 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - 2 - ((v - min) / range) * (height - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const path = `M${pts.join(" L")}`;
  const areaPath = `${path} L${width},${height} L0,${height} Z`;
  const gradId = `spark-${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={width} cy={height - 2 - ((data[data.length - 1] - min) / range) * (height - 4)} r={2.5} fill={color} />
    </svg>
  );
}

// ---------- Chart shell ----------

function ChartShell({
  title,
  subtitle,
  controls,
  children,
  testId,
  className = "",
  height = "280px",
}: {
  title: string;
  subtitle?: string;
  controls?: React.ReactNode;
  children: React.ReactNode;
  testId: string;
  className?: string;
  height?: string;
}) {
  return (
    <Card className={`p-5 flex flex-col gap-4 min-w-0 ${className}`} data-testid={testId}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-tight">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {controls && <div className="flex gap-2 items-center flex-wrap">{controls}</div>}
      </div>
      <div className="w-full min-w-0" style={{ height }}>{children}</div>
    </Card>
  );
}

function MetricSelect({ value, options, onChange, testId }: { value: string; options: string[]; onChange: (v: string) => void; testId: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-auto min-w-[120px] text-xs" data-testid={testId}><SelectValue /></SelectTrigger>
      <SelectContent>{options.map((o) => <SelectItem key={o} value={o} className="text-xs">{o === "__count__" ? "Количество" : o}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function AggSelect({ value, onChange, testId }: { value: AggFn; onChange: (v: AggFn) => void; testId: string }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as AggFn)}>
      <SelectTrigger className="h-8 w-auto min-w-[100px] text-xs" data-testid={testId}><SelectValue /></SelectTrigger>
      <SelectContent>{(Object.keys(AGG_LABELS) as AggFn[]).map((a) => <SelectItem key={a} value={a} className="text-xs">{AGG_LABELS[a]}</SelectItem>)}</SelectContent>
    </Select>
  );
}

// ---------- Category Bar (горизонтальные бары с градиентом) ----------

export function CategoryBarCard({ dataset, dim, metrics, defaultMetric, index }: { dataset: Dataset; dim: string; metrics: string[]; defaultMetric: string; index: number }) {
  const [metric, setMetric] = useState(defaultMetric);
  const [agg, setAgg] = useState<AggFn>("sum");
  const data = useMemo(() => groupBy(dataset.rows, dim, agg === "count" ? null : metric, agg, 10), [dataset, dim, metric, agg]);
  const color = CHART_COLORS[index % CHART_COLORS.length];
  const gradId = `bar-grad-${index}`;
  return (
    <ChartShell
      title={dim}
      subtitle={`${AGG_LABELS[agg]}${agg !== "count" ? ` · ${metric}` : " строк"}`}
      testId={`chart-bar-${index}`}
      controls={<>{agg !== "count" && <MetricSelect value={metric} options={metrics} onChange={setMetric} testId={`select-metric-bar-${index}`} />}<AggSelect value={agg} onChange={setAgg} testId={`select-agg-bar-${index}`} /></>}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
          <defs><linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor={color} stopOpacity={0.7} /><stop offset="100%" stopColor={color} stopOpacity={1} /></linearGradient></defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis type="number" tick={axisTick} tickFormatter={formatNumber} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="label" width={110} tick={{ ...axisTick, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: string) => (v.length > 14 ? v.slice(0, 13) + "\u2026" : v)} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [formatNumber(v), AGG_LABELS[agg]]} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
          <Bar dataKey="value" fill={`url(#${gradId})`} radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive animationDuration={600} />
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

// ---------- Time Series (с аномалиями, прогнозом, reference line) ----------

export function TimeSeriesCard({ dataset, dateCol, metrics, defaultMetric }: { dataset: Dataset; dateCol: string; metrics: string[]; defaultMetric: string }) {
  const [metric, setMetric] = useState(defaultMetric);
  const [agg, setAgg] = useState<AggFn>("sum");
  const { data, grain } = useMemo(() => timeSeries(dataset.rows, dateCol, agg === "count" ? null : metric, agg), [dataset, dateCol, metric, agg]);

  const { chartData, anomalies, forecastPts, avgValue } = useMemo(() => {
    const pts = data.map((d) => ({ t: d.t, value: d.value }));
    const anoms = detectAnomalies(pts, 2.2);
    const anomSet = new Set(anoms.map((a) => a.t));
    const fc = forecastLinear(pts, Math.min(5, Math.max(2, Math.floor(data.length / 4))));
    const avg = pts.length ? pts.reduce((a, b) => a + b.value, 0) / pts.length : 0;
    const fmtLabel = (t: number) => {
      const d = new Date(t);
      if (grain === "year") return String(d.getFullYear());
      if (grain === "month") return `${d.getMonth() + 1}.${String(d.getFullYear()).slice(2)}`;
      return `${d.getDate()}.${d.getMonth() + 1}`;
    };
    const combined = [
      ...data.map((d) => ({ label: d.label, value: d.value, forecast: null as number | null, anomaly: anomSet.has(d.t) })),
      ...fc.map((f) => ({ label: fmtLabel(f.t), value: null as number | null, forecast: f.value, anomaly: false })),
    ];
    return { chartData: combined, anomalies: anomSet, forecastPts: fc, avgValue: avg };
  }, [data, grain]);

  const anomalyCount = anomalies.size;
  const subtitleParts = [`${AGG_LABELS[agg]}${agg !== "count" ? ` \u00b7 ${metric}` : " строк"}`];
  if (anomalyCount) subtitleParts.push(`${anomalyCount} аномал.`);
  if (forecastPts.length) subtitleParts.push(`прогноз +${forecastPts.length}`);

  return (
    <ChartShell
      title={`Динамика по \u00ab${dateCol}\u00bb`}
      subtitle={subtitleParts.join(" \u00b7 ")}
      testId="chart-timeseries"
      className="lg:col-span-2"
      height="320px"
      controls={<>{agg !== "count" && <MetricSelect value={metric} options={metrics} onChange={setMetric} testId="select-metric-ts" />}<AggSelect value={agg} onChange={setAgg} testId="select-agg-ts" /></>}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ left: 8, right: 16, top: 8, bottom: 4 }}>
          <defs>
            <linearGradient id="tsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
              <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} minTickGap={24} />
          <YAxis tick={axisTick} tickFormatter={formatNumber} axisLine={false} tickLine={false} width={52} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number | null) => (v != null ? [formatNumber(v), AGG_LABELS[agg]] : ["", ""])} />
          <ReferenceLine y={avgValue} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeWidth={1} opacity={0.5} />
          <Area type="monotone" dataKey="value" stroke="hsl(var(--chart-1))" strokeWidth={2.5} fill="url(#tsFill)" isAnimationActive animationDuration={800}
            dot={(props: { cx?: number; cy?: number; payload?: { anomaly?: boolean } }) => {
              if (!props.payload?.anomaly) return false;
              return <circle cx={props.cx} cy={props.cy} r={5} fill="hsl(var(--destructive))" stroke="hsl(var(--background))" strokeWidth={2} />;
            }}
          />
          {forecastPts.length > 0 && <Line type="monotone" dataKey="forecast" stroke="hsl(var(--chart-4))" strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive />}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

// ---------- Donut (с центром и hover) ----------

export function DonutCard({ dataset, dim, metrics, defaultMetric }: { dataset: Dataset; dim: string; metrics: string[]; defaultMetric: string }) {
  const [metric, setMetric] = useState(defaultMetric);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const data = useMemo(() => groupBy(dataset.rows, dim, metric === "__count__" ? null : metric, "sum", 7), [dataset, dim, metric]);
  const total = data.reduce((a, b) => a + b.value, 0);
  const hovered = hoverIdx !== null ? data[hoverIdx] : null;
  return (
    <ChartShell
      title={`Структура: ${dim}`}
      subtitle={metric === "__count__" ? "Доля строк" : `Доля \u00b7 ${metric}`}
      testId="chart-donut"
      controls={<MetricSelect value={metric} options={["__count__", ...metrics]} onChange={setMetric} testId="select-metric-donut" />}
    >
      <div className="flex h-full items-center gap-4">
        <div className="h-full flex-1 min-w-0 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="label" innerRadius="55%" outerRadius="85%" paddingAngle={2} strokeWidth={0} isAnimationActive animationDuration={700}
                onMouseEnter={(_, i) => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)}>
                {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} opacity={hoverIdx === null || hoverIdx === i ? 1 : 0.4} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => [`${formatNumber(v)} (${total ? Math.round((v / total) * 100) : 0}%)`, name]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-lg font-bold font-mono tabular-nums">{hovered ? `${Math.round((hovered.value / total) * 100)}%` : formatNumber(total)}</span>
            <span className="text-[10px] text-muted-foreground mt-0.5 max-w-[80px] truncate">{hovered ? hovered.label : "всего"}</span>
          </div>
        </div>
        <ul className="w-[42%] max-w-[180px] space-y-1.5 text-xs overflow-hidden">
          {data.slice(0, 7).map((d, i) => (
            <li key={d.label} className="flex items-center gap-2 min-w-0 cursor-pointer" onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)} data-testid={`legend-donut-${i}`}>
              <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
              <span className="truncate text-muted-foreground">{d.label}</span>
              <span className="ml-auto font-mono tabular-nums shrink-0">{total ? Math.round((d.value / total) * 100) : 0}%</span>
            </li>
          ))}
        </ul>
      </div>
    </ChartShell>
  );
}

// ---------- Histogram (с градиентом) ----------

export function HistogramCard({ dataset, metrics, defaultMetric }: { dataset: Dataset; metrics: string[]; defaultMetric: string }) {
  const [metric, setMetric] = useState(defaultMetric);
  const data = useMemo(() => histogram(dataset.rows, metric, 12), [dataset, metric]);
  return (
    <ChartShell title="Распределение" subtitle={metric} testId="chart-histogram" controls={<MetricSelect value={metric} options={metrics} onChange={setMetric} testId="select-metric-hist" />}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
          <defs><linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--chart-3))" stopOpacity={0.9} /><stop offset="100%" stopColor="hsl(var(--chart-3))" stopOpacity={0.5} /></linearGradient></defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="label" tick={false} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false} height={8} />
          <YAxis tick={axisTick} tickFormatter={formatNumber} axisLine={false} tickLine={false} width={44} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [formatNumber(v), "Строк"]} labelFormatter={(l: string) => `Диапазон: ${l}`} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
          <Bar dataKey="value" fill="url(#histGrad)" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={600} />
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

// ---------- Scatter (с тренд-линией) ----------

export function ScatterCard({ dataset, numCols }: { dataset: Dataset; numCols: string[] }) {
  const [xCol, setXCol] = useState(numCols[0]);
  const [yCol, setYCol] = useState(numCols[1]);
  const data = useMemo(() => scatterData(dataset.rows, xCol, yCol), [dataset, xCol, yCol]);
  const r = useMemo(() => correlation(dataset.rows, xCol, yCol), [dataset, xCol, yCol]);
  return (
    <ChartShell title="Взаимосвязь показателей" subtitle={r !== null ? `Корреляция r = ${r.toFixed(2)} (${r >= 0.7 ? "сильная" : r >= 0.4 ? "умеренная" : r >= 0.2 ? "слабая" : "нет"})` : undefined} testId="chart-scatter"
      controls={<><MetricSelect value={xCol} options={numCols} onChange={setXCol} testId="select-x-scatter" /><MetricSelect value={yCol} options={numCols} onChange={setYCol} testId="select-y-scatter" /></>}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ left: 8, right: 16, top: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="x" type="number" name={xCol} tick={axisTick} tickFormatter={formatNumber} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
          <YAxis dataKey="y" type="number" name={yCol} tick={axisTick} tickFormatter={formatNumber} axisLine={false} tickLine={false} width={52} domain={["auto", "auto"]} />
          <ZAxis range={[24, 24]} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatNumber(v)} cursor={{ strokeDasharray: "3 3" }} />
          <Scatter data={data} fill="hsl(var(--chart-2))" fillOpacity={0.5} isAnimationActive animationDuration={600} />
        </ScatterChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

// ---------- Leaderboard (с медалями, градиентами, тренд-бейджами) ----------

export function LeaderboardCard({ dataset, dim, metrics, defaultMetric, dateCol }: { dataset: Dataset; dim: string; metrics: string[]; defaultMetric: string; dateCol?: string }) {
  const [metric, setMetric] = useState(defaultMetric);
  const [agg, setAgg] = useState<AggFn>("sum");
  const items = useMemo(() => rankWithTrend(dataset.rows, dim, agg === "count" ? null : metric, agg, dateCol, 8), [dataset, dim, metric, agg, dateCol]);
  const maxValue = Math.max(...items.map((i) => i.value), 1);
  const paretoData = pareto(items.map((i) => ({ label: i.label, value: i.value })));
  const top80 = paretoData.find((p) => p.cumPct >= 80);
  const medals = ["\uD83E\uDD47", "\uD83E\uDD48", "\uD83E\uDD49"];

  return (
    <ChartShell
      title={`Лидеры по \u00ab${dim}\u00bb`}
      subtitle={`${AGG_LABELS[agg]}${agg !== "count" ? ` \u00b7 ${metric}` : ""}${top80 ? ` \u00b7 топ-${paretoData.indexOf(top80) + 1} = 80%` : ""}`}
      testId="chart-leaderboard"
      controls={<>{agg !== "count" && <MetricSelect value={metric} options={metrics} onChange={setMetric} testId="select-metric-lb" />}<AggSelect value={agg} onChange={setAgg} testId="select-agg-lb" /></>}
    >
      <div className="h-full overflow-y-auto space-y-2.5 pr-1">
        {items.map((item, i) => (
          <div key={item.label} className="flex items-center gap-2 text-xs" data-testid={`leaderboard-item-${i}`}>
            <span className="w-6 text-center shrink-0">{i < 3 ? <span className="text-sm">{medals[i]}</span> : <span className="text-muted-foreground font-mono">{i + 1}</span>}</span>
            <span className="w-24 truncate shrink-0 font-medium" title={item.label}>{item.label}</span>
            <div className="flex-1 h-6 rounded-md bg-muted/40 overflow-hidden relative">
              <div className="h-full rounded-md transition-all duration-500" style={{ width: `${Math.max((item.value / maxValue) * 100, 3)}%`, background: `linear-gradient(90deg, hsl(var(--chart-${(i % 6) + 1}) / 0.6), hsl(var(--chart-${(i % 6) + 1})))` }} />
            </div>
            <span className="w-16 text-right font-mono tabular-nums shrink-0 font-semibold">{formatNumber(item.value)}</span>
            <span className="w-10 text-right text-muted-foreground font-mono tabular-nums shrink-0">{Math.round(item.share)}%</span>
            <span className="w-14 text-right shrink-0">
              {item.trend !== null ? (
                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${item.trend >= 0 ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                  {item.trend >= 0 ? "\u2191" : "\u2193"}{Math.abs(Math.round(item.trend))}%
                </span>
              ) : (<span className="text-muted-foreground">\u2014</span>)}
            </span>
          </div>
        ))}
      </div>
    </ChartShell>
  );
}

// ---------- Correlation Heatmap (новый) ----------

export function CorrelationHeatmapCard({ dataset, numCols }: { dataset: Dataset; numCols: string[] }) {
  const cols = numCols.slice(0, 6);
  const matrix = useMemo(() => {
    return cols.map((c1) => cols.map((c2) => correlation(dataset.rows, c1, c2)));
  }, [dataset, cols]);

  function heatColor(r: number | null): string {
    if (r === null) return "hsl(var(--muted) / 0.3)";
    const intensity = Math.min(Math.abs(r), 1);
    if (r >= 0) return `hsl(158 55% ${40 + intensity * 20}% / ${0.3 + intensity * 0.6})`;
    return `hsl(0 84% ${42 + intensity * 15}% / ${0.3 + intensity * 0.6})`;
  }

  return (
    <ChartShell title="Матрица корреляций" subtitle="Связь между числовыми показателями" testId="chart-correlation" className="lg:col-span-2" height="300px">
      <div className="overflow-x-auto">
        <table className="border-collapse mx-auto">
          <thead>
            <tr>
              <th className="w-24" />
              {cols.map((c) => <th key={c} className="text-[10px] text-muted-foreground font-normal px-1 pb-1 max-w-[80px] truncate" title={c}>{c.length > 10 ? c.slice(0, 9) + "\u2026" : c}</th>)}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr key={i}>
                <td className="text-[10px] text-muted-foreground font-normal pr-2 text-right max-w-[80px] truncate" title={cols[i]}>{cols[i].length > 10 ? cols[i].slice(0, 9) + "\u2026" : cols[i]}</td>
                {row.map((r, j) => (
                  <td key={j} className="p-0.5">
                    <div className="w-10 h-10 rounded-md flex items-center justify-center text-[10px] font-mono font-medium cursor-pointer hover:scale-110 transition-transform" style={{ backgroundColor: heatColor(r), color: r !== null && Math.abs(r) > 0.6 ? "white" : "hsl(var(--foreground))" }} title={`${cols[i]} vs ${cols[j]}: r=${r !== null ? r.toFixed(2) : "n/a"}`}>
                      {r !== null ? r.toFixed(1) : "\u2014"}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartShell>
  );
}
