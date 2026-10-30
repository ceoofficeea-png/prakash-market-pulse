import { Link, useRouterState } from "@tanstack/react-router";
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
import { can } from "@/lib/permissions";

interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

export const NAV: { label: string; items: NavItem[] }[] = [
  {
    label: "Command",
    items: [
      { title: "Executive Overview", url: "/overview", icon: Gauge },
      { title: "CEO Dashboard & Reports", url: "/reports", icon: BarChart3 },
      { title: "AI Intelligence", url: "/ai", icon: Bot },
    ],
  },
  {
    label: "Channels",
    items: [
      { title: "Social Media", url: "/social", icon: Share2 },
      { title: "Google & Meta Ads", url: "/ads", icon: MousePointerClick },
      { title: "Website & SEO", url: "/web", icon: Globe2 },
      { title: "Content", url: "/content", icon: FileText },
    ],
  },
  {
    label: "Growth",
    items: [
      { title: "Campaigns", url: "/campaigns", icon: Megaphone },
      { title: "CRM & Leads", url: "/crm", icon: UserSquare2 },
      { title: "Markets", url: "/markets", icon: LayoutGrid },
      { title: "Competitors", url: "/competitors", icon: Swords },
    ],
  },
  {
    label: "Organisation",
    items: [
      { title: "Team Performance", url: "/team", icon: Users },
      { title: "Administration", url: "/admin", icon: Settings2, adminOnly: true },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  const me = useCurrentUser();
  const isAdmin = can(me.data?.roles ?? [], "admin.access");

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
                  .filter((i) => !i.adminOnly || isAdmin)
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
