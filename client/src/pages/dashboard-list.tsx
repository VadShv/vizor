import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { UploadCloud, FileSpreadsheet, Trash2, Moon, Sun, Settings, Loader2 } from "lucide-react";
import { useData } from "@/lib/DataContext";

interface DatasetMeta { id: string; name: string; sourceFilename: string | null; rowCount: number; createdAt: string; updatedAt: string; }

export default function DashboardList() {
  const { currentOrg, logout, loading: authLoading } = useAuth();
  const { theme, toggleTheme } = useData();
  const [, navigate] = useLocation();
  const [datasets, setDatasets] = useState<DatasetMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!currentOrg) return;
    api<DatasetMeta[]>("GET", `/api/datasets?orgId=${currentOrg.id}`).then(setDatasets).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [currentOrg]);

  const del = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Удалить датасет?")) return;
    await api("DELETE", `/api/datasets/${id}`);
    setDatasets((d) => d.filter((x) => x.id !== id));
  };

  if (authLoading) return <div className="min-h-dvh flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Logo className="h-6 w-6 text-primary shrink-0" />
          <span className="font-semibold">Визор</span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Тема">{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/settings")}><Settings className="h-3.5 w-3.5 mr-1.5" /> {currentOrg?.name || "Настройки"}</Button>
            <Button variant="outline" size="sm" onClick={() => { logout(); navigate("/login"); }}>Выйти</Button>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold">Мои дашборды</h1>
          <Button onClick={() => navigate("/upload")}><UploadCloud className="h-4 w-4 mr-1.5" /> Загрузить файл</Button>
        </div>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : datasets.length === 0 ? (
          <div className="text-center py-16">
            <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
            <p className="mt-4 text-sm text-muted-foreground">Нет сохранённых дашбордов</p>
            <Button className="mt-4" onClick={() => navigate("/upload")}><UploadCloud className="h-4 w-4 mr-1.5" /> Загрузить первый файл</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {datasets.map((ds) => (
              <Card key={ds.id} className="p-5 cursor-pointer hover:border-primary/50 transition-colors group" onClick={() => navigate(`/d/${ds.id}`)}>
                <div className="flex items-start justify-between">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                  <button onClick={(e) => del(ds.id, e)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"><Trash2 className="h-4 w-4" /></button>
                </div>
                <h3 className="mt-3 text-sm font-semibold truncate">{ds.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground font-mono tabular-nums">{ds.rowCount.toLocaleString("ru-RU")} строк · {new Date(ds.updatedAt).toLocaleDateString("ru-RU")}</p>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
