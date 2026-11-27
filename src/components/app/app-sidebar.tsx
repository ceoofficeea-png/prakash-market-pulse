import { Link, useRouterState, type LinkProps } from "@tanstack/react-router";
import {
  BarChart3,
  Bot,
  Building2,
  FileText,
  Gauge,
  Globe2,
  LayoutGrid,
  Megaphone,
  MousePointerClick,
  Settings2,
  Share2,
  Swords,
  Users,
  UserSquare2,
  type LucideIcon,
} from "lucide-react";

import { Logo } from "@/components/app/logo";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useCurrentUser } from "@/lib/api";
import { allowedModules, can, type ModuleId } from "@/lib/permissions";

interface NavItem {
  title: string;
  url: NonNullable<LinkProps["to"]>;
  icon: LucideIcon;
  module: ModuleId;
  adminOnly?: boolean | undefined;
}

export const NAV: { label: string; items: NavItem[] }[] = [
  {
    label: "Command",
    items: [
      { title: "Executive Overview", url: "/overview", icon: Gauge, module: "overview" },
      { title: "CEO Dashboard & Reports", url: "/reports", icon: BarChart3, module: "reports" },
      { title: "AI Intelligence", url: "/ai", icon: Bot, module: "ai" },
    ],
  },
  {
    label: "Channels",
    items: [
      { title: "Social Media", url: "/social", icon: Share2, module: "social" },
      { title: "Google & Meta Ads", url: "/ads", icon: MousePointerClick, module: "ads" },
      { title: "Website & SEO", url: "/web", icon: Globe2, module: "web" },
      { title: "Content", url: "/content", icon: FileText, module: "content" },
    ],
  },
  {
    label: "Growth",
    items: [
      { title: "Campaigns", url: "/campaigns", icon: Megaphone, module: "campaigns" },
      { title: "CRM & Leads", url: "/crm", icon: UserSquare2, module: "crm" },
      { title: "Markets", url: "/markets", icon: LayoutGrid, module: "markets" },
      { title: "Competitors", url: "/competitors", icon: Swords, module: "competitors" },
    ],
  },
  {
    label: "Organisation",
    items: [
      { title: "Team Performance", url: "/team", icon: Users, module: "team" },
      { title: "Administration", url: "/admin", icon: Settings2, module: "admin", adminOnly: true },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  const me = useCurrentUser();
  const isAdmin = can(me.data?.roles ?? [], "admin.access");
  const visible = allowedModules(me.data?.modules ?? null, me.data?.role ?? "viewer");

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="h-14 justify-center border-b border-sidebar-border px-3">
        <Link to="/overview">
          <Logo collapsed={collapsed} />
        </Link>
      </SidebarHeader>
      <SidebarContent className="py-2">
        {NAV.map((group) => (
          <SidebarGroup key={group.label} className="py-1">
            <SidebarGroupLabel className="eyebrow text-[10px]">{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items
                  .filter((i) => (!i.adminOnly || isAdmin) && visible.includes(i.module))
                  .map((item) => {
                    const active = path === item.url || path.startsWith(item.url + "/");
                    return (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={item.title}
                          className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-primary data-[active=true]:font-medium"
                        >
                          <Link to={item.url}>
                            <item.icon className="size-4" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      {!collapsed && (
        <div className="m-3 rounded-lg border border-sidebar-border bg-sidebar-accent/50 p-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 font-medium text-foreground">
            <Building2 className="size-3.5 text-primary" /> 14 markets · 6 regions
          </div>
          <p className="mt-1">Demo data stage — API connections planned.</p>
        </div>
      )}
    </Sidebar>
  );
}
