import "@lovable.dev/cloud-auth-js/styles.css";

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { z } from "zod";

import heroImg from "@/assets/auth-hero.jpg";
import { LogoMark } from "@/components/app/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — Prakash Pump Marketing Command Center" },
      { name: "description", content: "Sign in to the Prakash Pump marketing operations platform." },
      { property: "og:title", content: "Sign in — Prakash Pump Marketing Command Center" },
      { property: "og:description", content: "Sign in to the Prakash Pump marketing operations platform." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const safePath = (p?: string) => {
  if (!p) return "/overview";
  try {
    const u = new URL(p, window.location.origin);
    return u.origin === window.location.origin ? u.pathname + u.search : "/overview";
  } catch {
    return "/overview";
  }
};

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.7 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12Z" />
    </svg>
  );
}

function AuthPage() {
  const { redirect: redirectTo } = Route.useSearch();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: safePath(redirectTo), replace: true });
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate({ to: safePath(redirectTo), replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate, redirectTo]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
        if (error) throw error;
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: form.name } },
        });
        if (error) throw error;
        if (!data.session) toast.success("Check your inbox to confirm your email, then sign in.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Password reset link sent. Check your inbox.");
        setMode("signin");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const oauth = async (provider: "google" | "lovable") => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin + "/auth" });
    if (result.error) {
      toast.error(result.error.message ?? "Sign-in failed");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: safePath(redirectTo), replace: true });
  };

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden lg:block">
        <img src={heroImg} alt="Industrial pumping station" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-background/10" />
        <div className="absolute inset-x-0 bottom-0 p-10">
          <div className="eyebrow text-primary">Marketing Command Center</div>
          <h1 className="mt-2 max-w-lg text-4xl font-semibold leading-tight text-foreground">
            Every market, campaign and lead — in one place.
          </h1>
          <div className="mt-6 grid max-w-lg grid-cols-3 gap-3">
            {[
              ["14", "Markets"],
              ["13", "Modules"],
              ["4", "Ad platforms"],
            ].map(([v, l]) => (
              <div key={l} className="rounded-lg border border-border bg-background/60 p-3 backdrop-blur">
                <div className="num text-2xl font-semibold text-foreground">{v}</div>
                <div className="eyebrow">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3">
            <LogoMark className="size-10" />
            <div>
              <div className="font-display text-lg font-semibold">Prakash Pump</div>
              <div className="eyebrow">Marketing Command Center</div>
            </div>
          </div>

          {mode === "forgot" ? (
            <form onSubmit={onSubmit} className="space-y-4">
              <h2 className="text-xl font-semibold">Reset your password</h2>
              <p className="text-sm text-muted-foreground">We'll email you a secure link to set a new password.</p>
              <div className="space-y-1.5">
                <Label htmlFor="email">Work email</Label>
                <Input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="animate-spin" />} Send reset link
              </Button>
              <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode("signin")}>
                ← Back to sign in
              </button>
            </form>
          ) : (
            <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")}>
              <TabsList className="mb-5 grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>

              <div className="space-y-2">
                <Button type="button" variant="outline" className="w-full" onClick={() => oauth("google")} disabled={busy}>
                  <GoogleIcon /> Continue with Google
                </Button>
                <button type="button" className="lovable-auth-button w-full" onClick={() => oauth("lovable")} disabled={busy}>
                  Continue with Lovable
                </button>
              </div>

              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> or with email <span className="h-px flex-1 bg-border" />
              </div>

              <form onSubmit={onSubmit} className="space-y-4">
                <TabsContent value="signup" className="m-0 space-y-1.5">
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" required={mode === "signup"} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </TabsContent>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Work email</Label>
                  <Input id="email" type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {mode === "signin" && (
                      <button type="button" className="text-xs text-muted-foreground hover:text-primary" onClick={() => setMode("forgot")}>
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <Input
                    id="password"
                    type="password"
                    minLength={8}
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    required
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy && <Loader2 className="animate-spin" />}
                  {mode === "signin" ? "Sign in" : "Create account"}
                </Button>
              </form>
              <p className="mt-6 text-xs text-muted-foreground">
                The first account created becomes the administrator. New team members start with view-only access until an administrator assigns a role.
              </p>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}
