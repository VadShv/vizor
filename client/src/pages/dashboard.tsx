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
  Search,
  Download,
  X,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
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
  profileColumns,
  periodDelta,
  detectAnomalies,
  type RankItem,
} from "@/lib/dataEngine";
import {
  CategoryBarCard,
  TimeSeriesCard,
  DonutCard,
  HistogramCard,
  ScatterCard,
  LeaderboardCard,
} from "@/components/charts";
import { Logo } from "@/components/logo";

function exportCsv(ds: Dataset) {
  const headers = ds.columns.map((c) => c.name);
  const lines = [headers.join(",")];
  for (const row of ds.rows) {
    lines.push(
      headers
        .map((h) => {
          const v = String(row[h] ?? "");
          return v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
        })
        .join(","),
    );
  }
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = ds.name.replace(/\.[^.]+$/, "") + "-export.csv";
  a.click();
  URL.revokeObjectURL(url);
}

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

    if (data.length >= 6) {
      const anomalies = detectAnomalies(data.map((d) => ({ t: d.t, value: d.value })), 2.2);
      if (anomalies.length) {
        const a = anomalies[0];
        const label = data.find((d) => d.t === a.t)?.label ?? "";
        insights.push(
          `Аномалия в «${label}»: отклонение ${a.zscore > 0 ? "+" : ""}${a.zscore.toFixed(1)}σ от нормы.`,
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

function HeadlineMetrics({ ds, dateCols, numCols }: { ds: Dataset; dateCols: string[]; numCols: string[] }) {
  const isPercentLike = (name: string) => PERCENT_KEYWORDS.test(name);
  const mainMetric = numCols[0];
  const mainCol = ds.columns.find((c) => c.name === mainMetric);
  const otherMetrics = numCols.slice(1, 4);

  const mainDelta = useMemo(() => {
    if (!mainMetric || !dateCols.length) return null;
    return periodDelta(ds.rows, dateCols[0], mainMetric, "sum");
  }, [ds, dateCols, mainMetric]);

  if (!mainMetric || !mainCol) return null;
  const mainValue = isPercentLike(mainMetric) ? mainCol.mean : mainCol.sum;

  return (
    <div className="space-y-3">
      <Card className="p-5" data-testid="card-headline">
        <div className="flex items-end gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">
              {isPercentLike(mainMetric) ? "Среднее" : "Сумма"} · {mainMetric}
            </div>
            <div className="mt-1 text-3xl font-bold font-mono tabular-nums" data-testid="headline-value">
              {formatNumber(mainValue ?? 0)}
            </div>
          </div>
          {mainDelta && (
            <div className={`flex items-center gap-1.5 text-sm font-medium pb-1.5 ${mainDelta.deltaPct >= 0 ? "text-primary" : "text-destructive"}`} data-testid="headline-delta">
              {mainDelta.deltaPct >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {mainDelta.deltaPct >= 0 ? "+" : ""}{Math.round(mainDelta.deltaPct)}% к прошлому периоду
            </div>
          )}
        </div>
      </Card>

      {otherMetrics.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {otherMetrics.map((name, i) => {
            const col = ds.columns.find((c) => c.name === name);
            if (!col) return null;
            const val = isPercentLike(name) ? col.mean : col.sum;
            const delta = dateCols.length ? periodDelta(ds.rows, dateCols[0], name, "sum") : null;
            return (
              <Card className="p-4 min-w-0" key={name} data-testid={`card-metric-${i}`}>
                <div className="text-xs text-muted-foreground truncate" title={name}>
                  {isPercentLike(name) ? "ср." : "Σ"} {name}
                </div>
                <div className="mt-1 text-lg font-bold font-mono tabular-nums truncate">{formatNumber(val ?? 0)}</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs font-mono tabular-nums">
                  {delta ? (
                    <span className={delta.deltaPct >= 0 ? "text-primary" : "text-destructive"}>
                      {delta.deltaPct >= 0 ? "↑" : "↓"}{Math.abs(Math.round(delta.deltaPct))}%
                    </span>
                  ) : (
                    <span className="text-muted-foreground">ср. {formatNumber(col.mean ?? 0)}</span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
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
  const [searchQuery, setSearchQuery] = useState("");

  const picked = useMemo(() => (dataset ? pickColumns(dataset) : null), [dataset]);

  const filteredDataset = useMemo(() => {
    if (!dataset) return null;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return dataset;
    const rows = dataset.rows.filter((r) =>
      Object.values(r).some((v) => v != null && String(v).toLowerCase().includes(q)),
    );
    if (!rows.length) return { ...dataset, rows: [], columns: dataset.columns };
    return { ...dataset, rows, columns: profileColumns(rows) };
  }, [dataset, searchQuery]);

  const insights = useMemo(
    () => (filteredDataset ? buildInsights(filteredDataset) : []),
    [filteredDataset],
  );

  useEffect(() => {
    if (!dataset) navigate("/");
  }, [dataset, navigate]);

  if (!dataset || !picked || !filteredDataset) return null;

  const { numCols, dateCols, catCols } = picked;
  const defaultMetric = numCols[0];
  const dsKey = `${dataset.name}:${filteredDataset.rows.length}:${searchQuery}`;
  const showDs = filteredDataset;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Logo className="h-6 w-6 text-primary shrink-0" />
          <div className="min-w-0">
            <h1 className="text-sm font-semibold truncate" data-testid="text-dataset-name">
              {dataset.name}
            </h1>
            <p className="text-xs text-muted-foreground">
              {searchQuery ? `${showDs.rows.length.toLocaleString("ru-RU")} из ${dataset.rows.length.toLocaleString("ru-RU")}` : "Дашборд"}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative hidden sm:block">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск…"
                className="h-8 w-40 pl-8 pr-7 rounded-md border border-border bg-background text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                data-testid="input-search"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Очистить"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => exportCsv(showDs)} data-testid="button-export-csv">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              CSV
            </Button>
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
        <HeadlineMetrics ds={showDs} dateCols={dateCols} numCols={numCols} />

        {dateCols.length > 0 && numCols.length > 0 && (
          <TimeSeriesCard key={`ts-${dsKey}`} dataset={showDs} dateCol={dateCols[0]} metrics={numCols} defaultMetric={defaultMetric} />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {catCols.length > 0 && numCols.length > 0 && (
            <LeaderboardCard
              key={`lb-${dsKey}`}
              dataset={showDs}
              dim={catCols[0]}
              metrics={numCols}
              defaultMetric={defaultMetric}
              dateCol={dateCols[0]}
            />
          )}
          {catCols.length > 0 && (
            <DonutCard
              key={`donut-${dsKey}`}
              dataset={showDs}
              dim={catCols.length > 1 ? catCols[1] : catCols[0]}
              metrics={numCols}
              defaultMetric={numCols[0] ?? "__count__"}
            />
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {catCols.slice(0, 2).map((cat, i) =>
            numCols.length > 0 ? (
              <CategoryBarCard
                key={`bar-${cat}-${dsKey}`}
                dataset={showDs}
                dim={cat}
                metrics={numCols}
                defaultMetric={defaultMetric}
                index={i}
              />
            ) : null,
          )}
          {numCols.length > 0 && (
            <HistogramCard key={`hist-${dsKey}`} dataset={showDs} metrics={numCols} defaultMetric={defaultMetric} />
          )}
          {numCols.length >= 2 && <ScatterCard key={`scatter-${dsKey}`} dataset={showDs} numCols={numCols} />}
        </div>

        {insights.length > 0 && (
          <Card className="p-5" data-testid="card-insights">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-primary" />
              Инсайты
            </div>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {insights.map((ins, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground" data-testid={`text-insight-${i}`}>
                  {ins.includes("снизил") || ins.includes("Аномалия") ? (
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
                  ) : ins.includes("выросла") || ins.includes("Лидер") ? (
                    <ArrowUpRight className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  )}
                  <span>{ins}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <DataTable ds={showDs} />
      </main>

      <footer className="border-t border-border bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4 font-mono tabular-nums">
            <span className="flex items-center gap-1"><Rows3 className="h-3 w-3" /> {showDs.rows.length.toLocaleString("ru-RU")} строк</span>
            <span className="flex items-center gap-1"><Columns3 className="h-3 w-3" /> {dataset.columns.length} колонок</span>
          </div>
          <div className="flex flex-wrap gap-1.5 max-w-[60%]">
            {dataset.columns.map((c: ColumnProfile) => (
              <Badge key={c.name} variant="secondary" className="text-[10px] font-normal px-1.5 py-0">
                {c.name}<span className="ml-1 opacity-50">{TYPE_LABELS[c.type]}</span>
              </Badge>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
