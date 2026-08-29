import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useData } from "@/lib/DataContext";
import { api } from "@/lib/api";
import type { Dataset } from "@/lib/dataEngine";
import Dashboard from "./dashboard";
import { Loader2 } from "lucide-react";

export default function SavedView({ id }: { id: string }) {
  const { setDataset, setDatasetId, setReadOnly } = useData();
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ id: string; name: string; rows: Record<string, unknown>[]; columns: unknown[] }>("GET", `/api/datasets/${id}`)
      .then((data) => { setDataset({ name: data.name, rows: data.rows, columns: data.columns as Dataset["columns"] }); setDatasetId(data.id); setReadOnly(false); })
      .catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="min-h-dvh flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (error) return <div className="min-h-dvh flex flex-col items-center justify-center"><p className="text-sm text-destructive">{error}</p><button onClick={() => navigate("/")} className="mt-4 text-primary">Назад</button></div>;
  return <Dashboard />;
}
