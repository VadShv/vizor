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
  LineChart,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
  ComposedChart,
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

const tooltipStyle = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--popover-border))",
  borderRadius: "8px",
  fontSize: "13px",
  color: "hsl(var(--popover-foreground))",
  fontFamily: "'JetBrains Mono', monospace",
};

const axisTick = { fontSize: 11, fill: "hsl(var(--muted-foreground))" };

// ---------- Card shell ----------

function ChartShell({
  title,
  subtitle,
  controls,
  children,
  testId,
  className = "",
}: {
  title: string;
  subtitle?: string;
  controls?: React.ReactNode;
  children: React.ReactNode;
  testId: string;
  className?: string;
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
      <div className="h-[280px] w-full min-w-0">{children}</div>
    </Card>
  );
}

function MetricSelect({
  value,
  options,
  onChange,
  testId,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  testId: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-auto min-w-[120px] text-xs" data-testid={testId}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o} className="text-xs">
            {o === "__count__" ? "Количество строк" : o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function AggSelect({
  value,
  onChange,
  testId,
}: {
  value: AggFn;
  onChange: (v: AggFn) => void;
  testId: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as AggFn)}>
      <SelectTrigger className="h-8 w-auto min-w-[104px] text-xs" data-testid={testId}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(AGG_LABELS) as AggFn[]).map((a) => (
          <SelectItem key={a} value={a} className="text-xs">
            {AGG_LABELS[a]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ---------- Charts ----------

export function CategoryBarCard({
  dataset,
  dim,
  metrics,
  defaultMetric,
  index,
}: {
  dataset: Dataset;
  dim: string;
  metrics: string[];
  defaultMetric: string;
  index: number;
}) {
  const [metric, setMetric] = useState(defaultMetric);
  const [agg, setAgg] = useState<AggFn>("sum");
  const data = useMemo(
    () => groupBy(dataset.rows, dim, agg === "count" ? null : metric, agg, 10),
    [dataset, dim, metric, agg],
  );
  const color = CHART_COLORS[index % CHART_COLORS.length];
  return (
    <ChartShell
      title={dim}
      subtitle={`${AGG_LABELS[agg]}${agg !== "count" ? ` · ${metric}` : " строк"}`}
      testId={`chart-bar-${index}`}
      controls={
        <>
          {agg !== "count" && (
            <MetricSelect value={metric} options={metrics} onChange={setMetric} testId={`select-metric-bar-${index}`} />
          )}
          <AggSelect value={agg} onChange={setAgg} testId={`select-agg-bar-${index}`} />
        </>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis type="number" tick={axisTick} tickFormatter={formatNumber} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="label"
            width={110}
            tick={{ ...axisTick, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: string) => (v.length > 14 ? v.slice(0, 13) + "…" : v)}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v: number) => [formatNumber(v), AGG_LABELS[agg]]}
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
          />
          <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive />
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export function TimeSeriesCard({
  dataset,
  dateCol,
  metrics,
  defaultMetric,
}: {
  dataset: Dataset;
  dateCol: string;
  metrics: string[];
  defaultMetric: string;
}) {
  const [metric, setMetric] = useState(defaultMetric);
  const [agg, setAgg] = useState<AggFn>("sum");
  const { data, grain } = useMemo(
    () => timeSeries(dataset.rows, dateCol, agg === "count" ? null : metric, agg),
    [dataset, dateCol, metric, agg],
  );

  const { chartData, anomalies, forecastPts } = useMemo(() => {
    const pts = data.map((d) => ({ t: d.t, value: d.value }));
    const anoms = detectAnomalies(pts, 2.2);
    const anomSet = new Set(anoms.map((a) => a.t));
    const fc = forecastLinear(pts, Math.min(5, Math.max(2, Math.floor(data.length / 4))));
    const fmtLabel = (t: number) => {
      const d = new Date(t);
      if (grain === "year") return String(d.getFullYear());
      if (grain === "month") return `${d.getMonth() + 1}.${String(d.getFullYear()).slice(2)}`;
      return `${d.getDate()}.${d.getMonth() + 1}`;
    };
    const combined = [
      ...data.map((d) => ({
        label: d.label,
        value: d.value,
        forecast: null as number | null,
        anomaly: anomSet.has(d.t),
      })),
      ...fc.map((f) => ({
        label: fmtLabel(f.t),
        value: null as number | null,
        forecast: f.value,
        anomaly: false,
      })),
    ];
    return { chartData: combined, anomalies: anoms, forecastPts: fc };
  }, [data, grain]);

  const anomalyCount = anomalies.size;
  const subtitleParts = [`${AGG_LABELS[agg]}${agg !== "count" ? ` · ${metric}` : " строк"}`];
  if (anomalyCount) subtitleParts.push(`${anomalyCount} аномал.`);
  if (forecastPts.length) subtitleParts.push(`прогноз +${forecastPts.length}`);

  return (
    <ChartShell
      title={`Динамика по «${dateCol}»`}
      subtitle={subtitleParts.join(" · ")}
      testId="chart-timeseries"
      className="lg:col-span-2"
      controls={
        <>
          {agg !== "count" && (
            <MetricSelect value={metric} options={metrics} onChange={setMetric} testId="select-metric-ts" />
          )}
          <AggSelect value={agg} onChange={setAgg} testId="select-agg-ts" />
        </>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ left: 8, right: 16, top: 8, bottom: 4 }}>
          <defs>
            <linearGradient id="tsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.28} />
              <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} minTickGap={24} />
          <YAxis tick={axisTick} tickFormatter={formatNumber} axisLine={false} tickLine={false} width={52} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v: number | null) => (v != null ? [formatNumber(v), AGG_LABELS[agg]] : ["", ""])}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="hsl(var(--chart-1))"
            strokeWidth={2}
            fill="url(#tsFill)"
            isAnimationActive
            dot={(props: { cx?: number; cy?: number; payload?: { anomaly?: boolean } }) => {
              if (!props.payload?.anomaly) return false;
              return (
                <circle
                  cx={props.cx}
                  cy={props.cy}
                  r={4}
                  fill="hsl(var(--destructive))"
                  stroke="hsl(var(--background))"
                  strokeWidth={1.5}
                />
              );
            }}
          />
          {forecastPts.length > 0 && (
            <Line
              type="monotone"
              dataKey="forecast"
              stroke="hsl(var(--chart-4))"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              dot={false}
              isAnimationActive
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export function DonutCard({
  dataset,
  dim,
  metrics,
  defaultMetric,
}: {
  dataset: Dataset;
  dim: string;
  metrics: string[];
  defaultMetric: string;
}) {
  const [metric, setMetric] = useState(defaultMetric);
  const data = useMemo(
    () => groupBy(dataset.rows, dim, metric === "__count__" ? null : metric, "sum", 7),
    [dataset, dim, metric],
  );
  const total = data.reduce((a, b) => a + b.value, 0);
  return (
    <ChartShell
      title={`Структура: ${dim}`}
      subtitle={metric === "__count__" ? "Доля строк" : `Доля · ${metric}`}
      testId="chart-donut"
      controls={
        <MetricSelect
          value={metric}
          options={["__count__", ...metrics]}
          onChange={setMetric}
          testId="select-metric-donut"
        />
      }
    >
      <div className="flex h-full items-center gap-4">
        <div className="h-full flex-1 min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                innerRadius="58%"
                outerRadius="88%"
                paddingAngle={2}
                strokeWidth={0}
                isAnimationActive
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number, name: string) => [
                  `${formatNumber(v)} (${total ? Math.round((v / total) * 100) : 0}%)`,
                  name,
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="w-[45%] max-w-[200px] space-y-1.5 text-xs overflow-hidden">
          {data.slice(0, 7).map((d, i) => (
            <li key={d.label} className="flex items-center gap-2 min-w-0" data-testid={`legend-donut-${i}`}>
              <span
                className="h-2.5 w-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
              />
              <span className="truncate text-muted-foreground">{d.label}</span>
              <span className="ml-auto font-mono tabular-nums shrink-0">
                {total ? Math.round((d.value / total) * 100) : 0}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </ChartShell>
  );
}

export function HistogramCard({ dataset, metrics, defaultMetric }: { dataset: Dataset; metrics: string[]; defaultMetric: string }) {
  const [metric, setMetric] = useState(defaultMetric);
  const data = useMemo(() => histogram(dataset.rows, metric, 12), [dataset, metric]);
  return (
    <ChartShell
      title="Распределение"
      subtitle={metric}
      testId="chart-histogram"
      controls={<MetricSelect value={metric} options={metrics} onChange={setMetric} testId="select-metric-hist" />}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="label" tick={false} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false} height={8} />
          <YAxis tick={axisTick} tickFormatter={formatNumber} axisLine={false} tickLine={false} width={44} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v: number) => [formatNumber(v), "Строк"]}
            labelFormatter={(l: string) => `Диапазон: ${l}`}
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
          />
          <Bar dataKey="value" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} isAnimationActive />
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export function ScatterCard({ dataset, numCols }: { dataset: Dataset; numCols: string[] }) {
  const [xCol, setXCol] = useState(numCols[0]);
  const [yCol, setYCol] = useState(numCols[1]);
  const data = useMemo(() => scatterData(dataset.rows, xCol, yCol), [dataset, xCol, yCol]);
  const r = useMemo(() => correlation(dataset.rows, xCol, yCol), [dataset, xCol, yCol]);
  return (
    <ChartShell
      title="Взаимосвязь показателей"
      subtitle={r !== null ? `Корреляция r = ${r.toFixed(2)}` : undefined}
      testId="chart-scatter"
      controls={
        <>
          <MetricSelect value={xCol} options={numCols} onChange={setXCol} testId="select-x-scatter" />
          <MetricSelect value={yCol} options={numCols} onChange={setYCol} testId="select-y-scatter" />
        </>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ left: 8, right: 16, top: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="x" type="number" name={xCol} tick={axisTick} tickFormatter={formatNumber} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
          <YAxis dataKey="y" type="number" name={yCol} tick={axisTick} tickFormatter={formatNumber} axisLine={false} tickLine={false} width={52} domain={["auto", "auto"]} />
          <ZAxis range={[28, 28]} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatNumber(v)} cursor={{ strokeDasharray: "3 3" }} />
          <Scatter data={data} fill="hsl(var(--chart-2))" fillOpacity={0.55} isAnimationActive />
        </ScatterChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export function LeaderboardCard({
  dataset,
  dim,
  metrics,
  defaultMetric,
  dateCol,
}: {
  dataset: Dataset;
  dim: string;
  metrics: string[];
  defaultMetric: string;
  dateCol?: string;
}) {
  const [metric, setMetric] = useState(defaultMetric);
  const [agg, setAgg] = useState<AggFn>("sum");
  const items = useMemo(
    () => rankWithTrend(dataset.rows, dim, agg === "count" ? null : metric, agg, dateCol, 8),
    [dataset, dim, metric, agg, dateCol],
  );
  const maxValue = Math.max(...items.map((i) => i.value), 1);
  const paretoData = pareto(items.map((i) => ({ label: i.label, value: i.value })));
  const top80 = paretoData.find((p) => p.cumPct >= 80);

  return (
    <ChartShell
      title={`Лидеры по «${dim}»`}
      subtitle={`${AGG_LABELS[agg]}${agg !== "count" ? ` · ${metric}` : ""}${top80 ? ` · топ-${paretoData.indexOf(top80) + 1} = 80%` : ""}`}
      testId="chart-leaderboard"
      controls={
        <>
          {agg !== "count" && (
            <MetricSelect value={metric} options={metrics} onChange={setMetric} testId="select-metric-lb" />
          )}
          <AggSelect value={agg} onChange={setAgg} testId="select-agg-lb" />
        </>
      }
    >
      <div className="h-full overflow-y-auto space-y-2 pr-1">
        {items.map((item, i) => (
          <div key={item.label} className="flex items-center gap-2 text-xs" data-testid={`leaderboard-item-${i}`}>
            <span className="w-5 text-muted-foreground font-mono shrink-0">{i + 1}</span>
            <span className="w-24 truncate shrink-0" title={item.label}>{item.label}</span>
            <div className="flex-1 h-5 rounded bg-muted/50 overflow-hidden relative">
              <div
                className="h-full rounded"
                style={{ width: `${(item.value / maxValue) * 100}%`, backgroundColor: `hsl(var(--chart-${(i % 6) + 1}))` }}
              />
            </div>
            <span className="w-16 text-right font-mono tabular-nums shrink-0">{formatNumber(item.value)}</span>
            <span className="w-10 text-right text-muted-foreground font-mono tabular-nums shrink-0">{Math.round(item.share)}%</span>
            <span className="w-12 text-right shrink-0 font-mono tabular-nums">
              {item.trend !== null ? (
                <span className={item.trend >= 0 ? "text-primary" : "text-destructive"}>
                  {item.trend >= 0 ? "↑" : "↓"}{Math.abs(Math.round(item.trend))}%
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </ChartShell>
  );
}
