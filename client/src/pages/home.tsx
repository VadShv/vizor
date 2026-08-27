import { useCallback, useRef, useState } from "react";
import { useLocation } from "wouter";
import { UploadCloud, FileSpreadsheet, Table2, Sparkles, BarChart3, Loader2, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useData } from "@/lib/DataContext";
import { parseFile } from "@/lib/dataEngine";
import { salesDemo, hrDemo } from "@/lib/demoData";
import { Logo } from "@/components/logo";

export default function Home() {
  const { setDataset, theme, toggleTheme } = useData();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!["csv", "xlsx", "xls", "tsv"].includes(ext || "")) {
        toast({
          title: "Неподдерживаемый формат",
          description: "Загрузите файл CSV, XLSX или XLS",
          variant: "destructive",
        });
        return;
      }
      setLoading(true);
      try {
        const ds = await parseFile(file);
        setDataset(ds);
        navigate("/dashboard");
      } catch (e) {
        toast({
          title: "Не удалось разобрать файл",
          description: e instanceof Error ? e.message : "Проверьте, что в файле есть таблица с заголовками",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    },
    [setDataset, navigate, toast],
  );

  const openDemo = (which: "sales" | "hr") => {
    setDataset(which === "sales" ? salesDemo() : hrDemo());
    navigate("/dashboard");
  };

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 max-w-5xl w-full mx-auto">
        <div className="flex items-center gap-2.5">
          <Logo className="h-7 w-7 text-primary" />
          <span className="font-semibold tracking-tight">Визор</span>
        </div>
        <Button variant="ghost" size="icon" onClick={toggleTheme} data-testid="button-theme" aria-label="Переключить тему">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-16">
        <div className="max-w-2xl w-full text-center">
          <h1 className="text-xl font-bold tracking-tight text-balance">
            Таблица&nbsp;— на входе. Дашборд&nbsp;— на выходе.
          </h1>
          <p className="mt-3 text-base text-muted-foreground text-balance">
            Загрузите CSV или Excel — Визор сам определит типы данных, посчитает метрики
            и соберёт интерактивную инфографику.
          </p>

          <div
            className={`mt-8 rounded-xl border-2 border-dashed transition-colors px-8 py-12 cursor-pointer select-none
              ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40"}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
            onClick={() => inputRef.current?.click()}
            data-testid="dropzone-upload"
            role="button"
            aria-label="Загрузить файл с данными"
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.tsv"
              className="hidden"
              data-testid="input-file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
            {loading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Анализируем данные…</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <UploadCloud className="h-6 w-6 text-primary" />
                </div>
                <p className="text-sm font-medium">Перетащите файл сюда или нажмите для выбора</p>
                <p className="text-xs text-muted-foreground">CSV, XLSX, XLS · до 100 000 строк</p>
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center gap-3 justify-center flex-wrap">
            <span className="text-xs text-muted-foreground">Нет файла под рукой?</span>
            <Button variant="outline" size="sm" onClick={() => openDemo("sales")} data-testid="button-demo-sales">
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
              Демо: продажи
            </Button>
            <Button variant="outline" size="sm" onClick={() => openDemo("hr")} data-testid="button-demo-hr">
              <Table2 className="h-3.5 w-3.5 mr-1.5" />
              Демо: сотрудники
            </Button>
          </div>
        </div>

        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl w-full">
          {[
            {
              icon: Table2,
              title: "Умный разбор",
              text: "Числа, даты и категории распознаются автоматически — включая русские форматы.",
            },
            {
              icon: BarChart3,
              title: "Автодашборд",
              text: "KPI-карточки, динамика, структура и распределения строятся без настройки.",
            },
            {
              icon: Sparkles,
              title: "Инсайты",
              text: "Сервис подсвечивает лидеров, тренды и связи между показателями.",
            },
          ].map((f) => (
            <div key={f.title} className="rounded-lg border border-card-border bg-card p-5 text-left">
              <f.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-3 text-sm font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{f.text}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-muted-foreground">
        Данные обрабатываются локально в вашем браузере и никуда не отправляются
      </footer>
    </div>
  );
}
