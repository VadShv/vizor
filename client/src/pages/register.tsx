import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { AuthLayout } from "./login";
import { Loader2 } from "lucide-react";

export default function Register() {
  const { register } = useAuth();
  const [, navigate] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(name, email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Регистрация" subtitle="Создайте аккаунт за минуту" footer={<a href="/login" className="text-primary hover:underline">Уже есть аккаунт? Войти</a>}>
      <form onSubmit={submit} className="space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <input placeholder="Имя" value={name} onChange={(e) => setName(e.target.value)} required className="w-full h-10 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full h-10 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
        <input type="password" placeholder="Пароль (мин. 6 символов)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="w-full h-10 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Создать аккаунт"}
        </Button>
      </form>
    </AuthLayout>
  );
}
