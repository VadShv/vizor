import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  Moon,
  Sun,
  Rows3,
  Columns3,
  Sparkles,
  ArrowUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useData } from "@/lib/DataContext";
import {
  Dataset,
  ColumnProfile,
  formatNumber,
  groupBy,
  timeSeries,
  correlation,
  toNumber,
} from "@/lib/dataEngine";
import {
  CategoryBarCard,
  TimeSeriesCard,
  DonutCard,
  HistogramCard,
  ScatterCard,
} from "@/components/charts";
import { Logo } from "@/components/logo";

const TYPE_LABELS: Record<string, string> = {
  numeric: "число",
  date: "дата",
  categorical: "категория",
  text: "текст",
};

const METRIC_KEYWORDS = /выручк|продаж|доход|сумма|revenue|sales|amount|total|price|стоимост|прибыл|зарплат|salary/i;
const PERCENT_KEYWORDS = /%|процент|скидк|доля|rate|ставк|оценк|рейтинг/i;

function pickColumns(ds: Dataset) {
  const usable = ds.columns.filter((c) => !c.isId);
  const numCols = usable
    .filter((c) => c.type === "numeric")
    .sort((a, b) => {
      const score = (c: ColumnProfile) =>
        (METRIC_KEYWORDS.test(c.name) ? 2 : 0) + (PERCENT_KEYWORDS.test(c.name) ? -1 : 0) + Math.min(1, Math.abs(c.sum ?? 0) / 1e6);
      return score(b) - score(a);
    })
    .map((c) => c.name);
  const dateCols = usable.filter((c) => c.type === "date").map((c) => c.name);
  const catCols = usable
    .filter((c) => c.type === "categorical" && c.uniqueCount >= 2 && c.uniqueCount <= 30)
    .sort((a, b) => a.uniqueCount - b.uniqueCount)
    .map((c) => c.name);
  return { numCols, dateCols, catCols };
}

function buildInsights(ds: Dataset): string[] {
  const { numCols, dateCols, catCols } = pickColumns(ds);
  const insights: string[] = [];
  const metric = numCols[0];

  if (catCols.length && metric) {
    const top = groupBy(ds.rows, catCols[0], metric, "sum", 100);
    const total = top.reduce((a, b) => a + b.value, 0);
    if (top.length && total > 0) {
      const share = Math.round((top[0].value / total) * 100);
      insights.push(`Лидер по «${catCols[0]}» — ${top[0].label}: ${share}% от общей суммы «${metric}».`);
    }
  }

  if (dateCols.length && metric) {
    const { data } = timeSeries(ds.rows, dateCols[0], metric, "sum");
    if (data.length >= 4) {
      const half = Math.floor(data.length / 2);
      const first = data.slice(0, half).reduce((a, b) => a + b.value, 0);
      const second = data.slice(half).reduce((a, b) => a + b.value, 0);
      if (first > 0) {
        const delta = Math.round(((second - first) / first) * 100);
        if (Math.abs(delta) >= 3)
        insights.push(
          delta >= 0
            ? `Во второй половине периода сумма «${metric}» выросла на ${delta}%.`
            : `Во второй половине периода сумма «${metric}» снизилась на ${Math.abs(delta)}%.`,
        );
      }
    }
  }

  if (numCols.length >= 2) {
    let best: { a: string; b: string; r: number } | null = null;
    for (let i = 0; i < Math.min(numCols.length, 4); i++) {
      for (let j = i + 1; j < Math.min(numCols.length, 4); j++) {
        const r = correlation(ds.rows, numCols[i], numCols[j]);
        if (r !== null && (!best || Math.abs(r) > Math.abs(best.r))) best = { a: numCols[i], b: numCols[j], r };
      }
    }
    if (best && Math.abs(best.r) >= 0.5) {
      insights.push(
        `${best.r > 0 ? "Прямая" : "Обратная"} связь между «${best.a}» и «${best.b}» (r = ${best.r.toFixed(2)}).`,
      );
    }
  }

  const worst = [...ds.columns].sort((a, b) => b.missingCount - a.missingCount)[0];
  if (worst && worst.missingCount / ds.rows.length > 0.05) {
    insights.push(
      `В колонке «${worst.name}» пропущено ${Math.round((worst.missingCount / ds.rows.length) * 100)}% значений.`,
    );
  }

  return insights.slice(0, 4);
}

function KpiRow({ ds }: { ds: Dataset }) {
  const numCols = ds.columns.filter((c) => c.type === "numeric" && !c.isId).slice(0, 3);
  const isPercentLike = (name: string) => PERCENT_KEYWORDS.test(name);
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      <Card className="p-4" data-testid="kpi-rows">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Rows3 className="h-3.5 w-3.5" /> Строк
        </div>
        <div className="mt-1.5 text-lg font-bold font-mono tabular-nums">{ds.rows.length.toLocaleString("ru-RU")}</div>
      </Card>
      <Card className="p-4" data-testid="kpi-cols">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Columns3 className="h-3.5 w-3.5" /> Колонок
        </div>
        <div className="mt-1.5 text-lg font-bold font-mono tabular-nums">{ds.columns.length}</div>
      </Card>
      {numCols.map((c, i) => (
        <Card className="p-4 min-w-0" key={c.name} data-testid={`kpi-num-${i}`}>
          <div className="text-xs text-muted-foreground truncate" title={c.name}>
            {isPercentLike(c.name) ? "ср." : "Σ"} {c.name}
          </div>
          <div className="mt-1.5 text-lg font-bold font-mono tabular-nums truncate">
            {formatNumber((isPercentLike(c.name) ? c.mean : c.sum) ?? 0)}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 font-mono tabular-nums">
            {isPercentLike(c.name)
              ? `от ${formatNumber(c.min ?? 0)} до ${formatNumber(c.max ?? 0)}`
              : `ср. ${formatNumber(c.mean ?? 0)}`}
          </div>
        </Card>
      ))}
    </div>
  );
}

function DataTable({ ds }: { ds: Dataset }) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const cols = ds.columns;

  const rows = useMemo(() => {
    const base = ds.rows.slice(0, 1000);
    if (!sortCol) return base.slice(0, 50);
    const profile = cols.find((c) => c.name === sortCol);
    const sorted = [...base].sort((a, b) => {
      if (profile?.type === "numeric") {
        return ((toNumber(a[sortCol]) ?? -Infinity) - (toNumber(b[sortCol]) ?? -Infinity)) * sortDir;
      }
      return String(a[sortCol] ?? "").localeCompare(String(b[sortCol] ?? ""), "ru") * sortDir;
    });
    return sorted.slice(0, 50);
  }, [ds, sortCol, sortDir, cols]);

  return (
    <Card className="overflow-hidden" data-testid="table-data">
      <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold">Данные</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Первые 50 строк из {ds.rows.length.toLocaleString("ru-RU")} · сортировка по клику на заголовок
          </p>
        </div>
      </div>
      <div className="overflow-x-auto border-t border-card-border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card z-[1]">
            <tr>
              {cols.map((c) => (
                <th
                  key={c.name}
                  className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => {
                    if (sortCol === c.name) setSortDir((d) => (d === 1 ? -1 : 1));
                    else {
                      setSortCol(c.name);
                      setSortDir(-1);
                    }
                  }}
                  data-testid={`th-${c.name}`}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.name}
                    <ArrowUpDown className={`h-3 w-3 ${sortCol === c.name ? "text-primary" : "opacity-30"}`} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-border/60 hover:bg-muted/40" data-testid={`row-data-${i}`}>
                {cols.map((c) => (
                  <td
                    key={c.name}
                    className={`px-4 py-2 whitespace-nowrap max-w-[240px] truncate ${
                      c.type === "numeric" ? "font-mono tabular-nums" : ""
                    }`}
                  >
                    {String(r[c.name] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const { dataset, theme, toggleTheme } = useData();
  const [, navigate] = useLocation();

  const picked = useMemo(() => (dataset ? pickColumns(dataset) : null), [dataset]);
  const insights = useMemo(() => (dataset ? buildInsights(dataset) : []), [dataset]);

  useEffect(() => {
    if (!dataset) navigate("/");
  }, [dataset, navigate]);

  if (!dataset || !picked) return null;

  const { numCols, dateCols, catCols } = picked;
  const defaultMetric = numCols[0];
  const dsKey = `${dataset.name}:${dataset.rows.length}:${dataset.columns.length}`;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Logo className="h-6 w-6 text-primary shrink-0" />
          <div className="min-w-0">
            <h1 className="text-sm font-semibold truncate" data-testid="text-dataset-name">
              {dataset.name}
            </h1>
            <p className="text-xs text-muted-foreground font-mono tabular-nums">
              {dataset.rows.length.toLocaleString("ru-RU")} строк · {dataset.columns.length} колонок
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme} data-testid="button-theme-dash" aria-label="Переключить тему">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/")} data-testid="button-new-file">
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              Другой файл
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 pb-16">
        {/* Колонки */}
        <div className="flex flex-wrap gap-1.5" data-testid="badges-columns">
          {dataset.columns.map((c: ColumnProfile) => (
            <Badge key={c.name} variant="secondary" className="text-xs font-normal">
              {c.name}
              <span className="ml-1.5 opacity-60">{TYPE_LABELS[c.type]}</span>
            </Badge>
          ))}
        </div>

        <KpiRow ds={dataset} />

        {insights.length > 0 && (
          <Card className="p-5" data-testid="card-insights">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-primary" />
              Инсайты
            </div>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {insights.map((ins, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground" data-testid={`text-insight-${i}`}>
                  {ins.includes("снизил") ? (
                    <ArrowDownRight className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                  )}
                  <span>{ins}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {dateCols.length > 0 && numCols.length > 0 && (
            <TimeSeriesCard key={`ts-${dsKey}`} dataset={dataset} dateCol={dateCols[0]} metrics={numCols} defaultMetric={defaultMetric} />
          )}
          {catCols.slice(0, 2).map((cat, i) =>
            numCols.length > 0 ? (
              <CategoryBarCard
                key={`bar-${cat}-${dsKey}`}
                dataset={dataset}
                dim={cat}
                metrics={numCols}
                defaultMetric={defaultMetric}
                index={i}
              />
            ) : null,
          )}
          {catCols.length > 0 && (
            <DonutCard
              key={`donut-${dsKey}`}
              dataset={dataset}
              dim={catCols.length > 2 ? catCols[2] : catCols[0]}
              metrics={numCols}
              defaultMetric={numCols[0] ?? "__count__"}
            />
          )}
          {numCols.length > 0 && (
            <HistogramCard key={`hist-${dsKey}`} dataset={dataset} metrics={numCols} defaultMetric={defaultMetric} />
          )}
          {numCols.length >= 2 && <ScatterCard key={`scatter-${dsKey}`} dataset={dataset} numCols={numCols} />}
        </div>

        <DataTable ds={dataset} />
      </main>
    </div>
  );
}
