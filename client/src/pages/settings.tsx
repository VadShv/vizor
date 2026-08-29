import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { Moon, Sun, ArrowLeft, UserPlus, Trash2 } from "lucide-react";
import { useData } from "@/lib/DataContext";

interface Member { userId: string; email: string; name: string; role: string; }

export default function Settings() {
  const { currentOrg, user } = useAuth();
  const { theme, toggleTheme } = useData();
  const [, navigate] = useLocation();
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (currentOrg) api<Member[]>("GET", `/api/orgs/${currentOrg.id}/members`).then(setMembers);
  }, [currentOrg]);

  const invite = async () => {
    if (!inviteEmail.trim() || !currentOrg) return;
    try {
      await api("POST", `/api/orgs/${currentOrg.id}/invite`, { email: inviteEmail, role: "viewer" });
      setMsg("Приглашение отправлено"); setInviteEmail("");
      setMembers(await api<Member[]>("GET", `/api/orgs/${currentOrg.id}/members`));
    } catch (e) { setMsg(e instanceof Error ? e.message : "Ошибка"); }
  };

  const remove = async (userId: string) => {
    if (!currentOrg || !confirm("Удалить участника?")) return;
    await api("DELETE", `/api/orgs/${currentOrg.id}/members/${userId}`);
    setMembers((m) => m.filter((x) => x.userId !== userId));
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Logo className="h-6 w-6 text-primary" /><span className="font-semibold">Настройки</span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme}>{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/")}><ArrowLeft className="h-3.5 w-3.5 mr-1.5" />Назад</Button>
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <Card className="p-5"><h2 className="text-sm font-semibold">Организация</h2><p className="mt-2 text-sm text-muted-foreground">{currentOrg?.name}</p></Card>
        <Card className="p-5">
          <h2 className="text-sm font-semibold">Участники</h2>
          <div className="mt-4 space-y-2">
            {members.map((m) => (
              <div key={m.userId} className="flex items-center gap-3 text-sm">
                <span className="flex-1 truncate">{m.name} <span className="text-muted-foreground">{m.email}</span></span>
                <span className="text-xs text-muted-foreground">{m.role}</span>
                {m.userId !== user?.id && <button onClick={() => remove(m.userId)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>}
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <input placeholder="email участника" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="flex-1 h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            <Button size="sm" onClick={invite}><UserPlus className="h-3.5 w-3.5 mr-1.5" />Пригласить</Button>
          </div>
          {msg && <p className="mt-2 text-xs text-muted-foreground">{msg}</p>}
        </Card>
      </main>
    </div>
  );
}
