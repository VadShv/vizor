import { useCallback, useRef, useState } from "react";
import { useLocation } from "wouter";
import { UploadCloud, FileSpreadsheet, Table2, Loader2, Moon, Sun, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useData } from "@/lib/DataContext";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import type { Dataset } from "@/lib/dataEngine";
import { salesDemo, hrDemo } from "@/lib/demoData";
import { Logo } from "@/components/logo";

function parseFileInWorker(file: File): Promise<Dataset> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../lib/parseWorker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<{ ok: boolean; dataset?: Dataset; error?: string }>) => {
      worker.terminate();
      if (e.data.ok) resolve(e.data.dataset!);
      else reject(new Error(e.data.error));
    };
    worker.postMessage(file);
  });
}

export default function Upload() {
  const { setDataset, setDatasetId, setReadOnly, theme, toggleTheme } = useData();
  const { currentOrg } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parsed, setParsed] = useState<Dataset | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["csv", "xlsx", "xls", "tsv"].includes(ext || "")) { toast({ title: "Неподдерживаемый формат", description: "Загрузите CSV, XLSX или XLS", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const ds = await parseFileInWorker(file);
      if (ds.truncated) toast({ title: "Файл обрезан", description: "Загружено только первые 100 000 строк" });
      setParsed(ds);
    } catch (e) { toast({ title: "Не удалось разобрать файл", description: e instanceof Error ? e.message : "Ошибка", variant: "destructive" }); }
    finally { setLoading(false); }
  }, [toast]);

  const save = async () => {
    if (!parsed) return;
    if (!currentOrg || !currentOrg.id) {
      toast({ title: "Нет организации", description: "Перезайдите в аккаунт", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const result = await api<{ id: string }>("POST", "/api/datasets", { orgId: currentOrg.id, name: parsed.name, sourceFilename: parsed.name, rows: parsed.rows, columns: parsed.columns });
      if (!result.id || result.id === "undefined") {
        toast({ title: "Ошибка сохранения", description: "Сервер вернул неверный ответ", variant: "destructive" });
        return;
      }
      setDataset(parsed); setDatasetId(result.id); setReadOnly(false);
      navigate(`/d/${result.id}`);
    } catch (e) { toast({ title: "Не удалось сохранить", description: e instanceof Error ? e.message : "Ошибка", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const openDemo = (which: "sales" | "hr") => setParsed(which === "sales" ? salesDemo() : hrDemo());

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 max-w-5xl w-full mx-auto">
        <div className="flex items-center gap-2.5"><Logo className="h-7 w-7 text-primary" /><span className="font-semibold tracking-tight">Визор</span></div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Тема">{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>Мои дашборды</Button>
        </div>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-16">
        <div className="max-w-2xl w-full text-center">
          {parsed ? (
            <>
              <h1 className="text-xl font-bold">{parsed.name}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{parsed.rows.length.toLocaleString("ru-RU")} строк · {parsed.columns.length} колонок · готов к сохранению</p>
              <div className="mt-8 flex items-center gap-3 justify-center">
                <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}Сохранить дашборд</Button>
                <Button variant="outline" onClick={() => setParsed(null)}>Другой файл</Button>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold tracking-tight">Таблица — на входе. Дашборд — на выходе.</h1>
              <p className="mt-3 text-base text-muted-foreground">Загрузите CSV или Excel — Визор построит интерактивный дашборд.</p>
              <div className={`mt-8 rounded-xl border-2 border-dashed transition-colors px-8 py-12 cursor-pointer select-none ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40"}`} onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }} onClick={() => inputRef.current?.click()} role="button" aria-label="Загрузить файл">
                <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls,.tsv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
                {loading ? (<div className="flex flex-col items-center gap-3"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="text-sm text-muted-foreground">Анализируем данные…</p></div>) : (<div className="flex flex-col items-center gap-3"><div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center"><UploadCloud className="h-6 w-6 text-primary" /></div><p className="text-sm font-medium">Перетащите файл сюда или нажмите для выбора</p><p className="text-xs text-muted-foreground">CSV, XLSX, XLS · до 100 000 строк</p></div>)}
              </div>
              <div className="mt-6 flex items-center gap-3 justify-center flex-wrap">
                <span className="text-xs text-muted-foreground">Нет файла?</span>
                <Button variant="outline" size="sm" onClick={() => openDemo("sales")}><FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />Демо: продажи</Button>
                <Button variant="outline" size="sm" onClick={() => openDemo("hr")}><Table2 className="h-3.5 w-3.5 mr-1.5" />Демо: сотрудники</Button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
