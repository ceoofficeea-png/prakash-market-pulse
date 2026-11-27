import { createFileRoute, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, type ReactNode } from "react";

import { AppSidebar } from "@/components/app/app-sidebar";
import { AppTopbar } from "@/components/app/app-topbar";
import { NoAccess } from "@/components/app/page";
import { SidebarProvider } from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/api";
import { FiltersProvider } from "@/lib/filters";
import { allowedModules, moduleForPath, moduleLabel, MODULES } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  return (
    <FiltersProvider>
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <AppTopbar />
            <main className="grid-bg flex-1 px-4 py-5 md:px-6">
              <div className="mx-auto max-w-[1600px]">
                <ModuleGuard>
                  <Outlet />
                </ModuleGuard>
              </div>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </FiltersProvider>
  );
}

/**
 * Blocks a module an administrator has not granted this account. Module access
 * is stored on the auth user's app metadata, which only the server can write.
 * The first permitted module becomes the landing page for restricted accounts.
 */
function ModuleGuard({ children }: { children: ReactNode }) {
  const me = useCurrentUser();
  const path = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();

  const role = me.data?.role ?? "viewer";
  const modules = me.data?.modules ?? null;
  const allowed = useMemo(() => allowedModules(modules, role), [modules, role]);

  const current = moduleForPath(path);
  const blockedModule = current !== null && !allowed.includes(current) ? current : null;
  const first = MODULES.find((m) => allowed.includes(m.id));

  useEffect(() => {
    if (!blockedModule || !first) return;
    navigate({ to: first.to, replace: true });
  }, [blockedModule, first, navigate]);

  if (blockedModule) {
    return first ? (
      <NoAccess
        what="this module"
        detail={`Your account can open ${allowed.length === 1 ? "only" : ""} ${allowed.map((id) => moduleLabel(id)).join(", ") || "no modules"}. Opening ${moduleLabel(blockedModule)} instead.`}
      />
    ) : (
      <NoAccess what="any module" detail="No modules have been granted to your account yet. Ask an administrator to update your module access." />
    );
  }

  return <>{children}</>;
}
