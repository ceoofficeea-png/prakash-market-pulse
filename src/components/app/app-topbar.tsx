import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Search, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { NAV } from "@/components/app/app-sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, useLookups } from "@/lib/api";
import { initials } from "@/lib/format";
import { roleLabel } from "@/lib/permissions";

export function AppTopbar() {
  const me = useCurrentUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { campaigns, countries, team } = useLookups();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const name = me.data?.profile?.full_name || me.data?.email || "";
  const go = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur">
      <SidebarTrigger className="text-muted-foreground" />
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 w-full max-w-md items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm text-muted-foreground hover:border-primary/40"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Search modules, campaigns, markets…</span>
        <kbd className="num rounded border border-border px-1.5 text-[10px]">⌘K</kbd>
      </button>
      <div className="ml-auto flex items-center gap-3">
        {me.data && (
          <Badge variant="signal" className="hidden gap-1 rounded-full md:inline-flex">
            <ShieldCheck className="size-3" /> {roleLabel(me.data.role)}
          </Badge>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 gap-2 px-2">
              <Avatar className="size-7">
                <AvatarFallback className="bg-primary/20 text-xs text-primary">{initials(name || "U")}</AvatarFallback>
              </Avatar>
              <span className="hidden max-w-40 truncate text-sm md:inline">{name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="truncate text-sm">{name}</div>
              <div className="truncate text-xs font-normal text-muted-foreground">{me.data?.email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {me.data?.role === "admin" && (
              <DropdownMenuItem asChild>
                <Link to="/admin">Administration</Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={signOut}>
              <LogOut /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Jump to…" />
        <CommandList>
          <CommandEmpty>Nothing found.</CommandEmpty>
          <CommandGroup heading="Modules">
            {NAV.flatMap((g) => g.items).map((i) => (
              <CommandItem key={i.url} onSelect={() => go(() => navigate({ to: i.url }))}>
                <i.icon /> {i.title}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Campaigns">
            {campaigns.map((c) => (
              <CommandItem key={c.id} value={`campaign ${c.name} ${c.code}`} onSelect={() => go(() => navigate({ to: "/campaigns/$id", params: { id: String(c.id) } }))}>
                {c.name}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Markets">
            {countries.map((c) => (
              <CommandItem key={c.code} value={`market ${c.name}`} onSelect={() => go(() => navigate({ to: "/markets/$code", params: { code: c.code } }))}>
                {c.flag} {c.name}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Team">
            {team.map((m) => (
              <CommandItem key={m.id} value={`team ${m.name}`} onSelect={() => go(() => navigate({ to: "/team/$id", params: { id: String(m.id) } }))}>
                {m.name} <span className="text-xs text-muted-foreground">· {m.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </header>
  );
}
