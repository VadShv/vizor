import { useEffect, useState } from "react";
import { useData } from "@/lib/DataContext";
import { api } from "@/lib/api";
import type { Dataset } from "@/lib/dataEngine";
import Dashboard from "./dashboard";
import { Loader2 } from "lucide-react";

export default function SharedView({ token }: { token: string }) {
  const { setDataset, setDatasetId, setReadOnly } = useData();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ name: string; rows: Record<string, unknown>[]; columns: unknown[] }>("GET", `/api/shared/${token}`)
      .then((data) => { setDataset({ name: data.name, rows: data.rows, columns: data.columns as Dataset["columns"] }); setDatasetId(null); setReadOnly(true); })
      .catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="min-h-dvh flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (error) return <div className="min-h-dvh flex flex-col items-center justify-center"><p className="text-sm text-destructive">{error}</p></div>;
  return <Dashboard />;
}
