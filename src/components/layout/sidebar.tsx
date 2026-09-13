"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { signOut, useSession } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getPusherClient } from "@/lib/pusher-client";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar } from "@/components/ui/avatar";
import { CalendarDays, Lightbulb, Trophy, Archive, ShieldCheck, Hammer, Target, Bell, Menu, X, Zap, Plus, ChevronsLeft, ChevronsRight, LogOut, LayoutDashboard, User, MessagesSquare } from "lucide-react";
import { canSessionRole } from "@/lib/authz/permissions";

const NAV_ITEMS = [
  { name: "Feed", href: "/feed", icon: Lightbulb },
  { name: "Communities", href: "/communities", icon: MessagesSquare },
  { name: "Leaderboard", href: "/leaderboard", icon: Trophy },
  { name: "The Forge", href: "/forge", icon: Hammer },
  { name: "Proof Wall", href: "/wall", icon: ShieldCheck },
  { name: "Bounties", href: "/bounties", icon: Target },
  { name: "Events", href: "/events", icon: CalendarDays },
  { name: "Archive", href: "/archive", icon: Archive },
  { name: "Notifications", href: "/notifications", icon: Bell },
];

const ADMIN_ITEMS = [
  { name: "Admin", href: "/admin", icon: LayoutDashboard },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const user = session?.user;
  // Staff nav, from the capability matrix. Hardcoding the role list here is
  // how the HOD ended up with no way to reach their own approval queue.
  const isAdmin = canSessionRole(user?.role, "VIEW_REPORTS");

  const queryClient = useQueryClient();
  const { data: notificationsData } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications");
      if (!res.ok) throw new Error("Could not load notifications");
      return res.json();
    },
    enabled: !!user?.id,
  });
  
  const unreadCount = notificationsData?.meta?.unreadCount ?? 0;

  useEffect(() => {
    if (!user?.id) return;
    const pusher = getPusherClient();
    const channelName = `user-${user.id}`;
    const channel = pusher.subscribe(channelName);
    
    channel.bind("notification-new", (notif: Record<string, unknown>) => {
       queryClient.setQueryData(["notifications"], (old: { data?: unknown[], meta?: { unreadCount?: number } } | undefined) => {
         if (!old) return old;
         return {
           data: [
             {
               _id: notif.id,
               type: notif.type.toLowerCase(),
               title: notif.title,
               body: notif.body,
               linkUrl: notif.href,
               isRead: notif.isRead,
               createdAt: notif.createdAt,
             },
             ...(old.data || [])
           ],
           meta: { unreadCount: (old.meta?.unreadCount || 0) + 1 }
         };
       });
    });
    
    channel.bind("notifications-bulk", () => {
       queryClient.invalidateQueries({ queryKey: ["notifications"] });
    });
    
    return () => {
      pusher.unsubscribe(channelName);
    };
  }, [user?.id, queryClient]);

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-paper-0 border-b border-rule flex items-center justify-between px-4">
        <Link href="/feed" className="flex items-center gap-2 font-bold text-sm tracking-tight">
          <div className="w-7 h-7 rounded-[var(--r-sm)] bg-ink-900 flex items-center justify-center">
            <Zap className="h-3.5 w-3.5 text-paper-0" />
          </div>
          <span className="font-display">IdeaSpace</span>
        </Link>
        <div className="flex items-center gap-1">
          <Link href="/ideas/new" className="p-2 rounded-lg hover:bg-paper-0/[0.04] transition-colors" aria-label="New idea">
            <Plus className="h-4 w-4 text-text-secondary" />
          </Link>
          <Link href="/notifications" className="relative p-2 rounded-lg hover:bg-paper-0/[0.04] transition-colors" aria-label="Notifications">
            <Bell className="h-4 w-4 text-text-secondary" />
            {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-ink-900" />}
          </Link>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-lg hover:bg-paper-0/[0.04] transition-colors"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 z-40 bg-ink-900/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-rule bg-paper-0 transition-all duration-300 ease-in-out",
          "md:translate-x-0",
          collapsed ? "md:w-[68px]" : "md:w-[260px]",
          mobileOpen ? "translate-x-0 w-[260px]" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center justify-between px-4 border-b border-rule">
          <Link
            href="/feed"
            className={cn("flex items-center gap-2.5 font-bold tracking-tight transition-all font-display", collapsed && "md:justify-center")}
          >
            <div className="w-8 h-8 rounded-[var(--r-sm)] bg-ink-900 flex items-center justify-center shrink-0">
              <Zap className="h-4 w-4 text-paper-0" />
            </div>
            {!collapsed && <span className="text-lg">IdeaSpace</span>}
          </Link>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex p-1.5 rounded-md text-text-muted hover:text-text-secondary hover:bg-paper-0/[0.04] transition-colors"
            aria-label="Toggle sidebar"
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Quick Action */}
        {!collapsed ? (
          <div className="px-3 pt-4 pb-2">
            <Link href="/ideas/new">
              <button className="w-full flex items-center gap-2 h-9 px-3 rounded-lg bg-ink-900/10 border border-stamp-verified/20 text-stamp-verified text-sm font-medium hover:bg-ink-900/15 transition-all cursor-pointer">
                <Plus className="h-4 w-4" />
                New Idea
              </button>
            </Link>
          </div>
        ) : (
          <div className="px-3 pt-4 pb-2 flex justify-center">
            <Link href="/ideas/new">
              <button className="h-9 w-9 flex items-center justify-center rounded-lg bg-ink-900/10 border border-stamp-verified/20 text-stamp-verified hover:bg-ink-900/15 transition-all cursor-pointer" aria-label="New idea">
                <Plus className="h-4 w-4" />
              </button>
            </Link>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {!collapsed && (
            <div className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">
              Platform
            </div>
          )}

          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/feed" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "group relative flex items-center rounded-lg text-sm font-medium transition-all duration-200",
                  collapsed ? "justify-center h-10 w-10 mx-auto" : "px-3 py-2.5 gap-3",
                  isActive
                    ? "text-text-primary"
                    : "text-text-secondary hover:text-text-primary hover:bg-paper-0/[0.03]"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute inset-0 bg-ink-900/[0.08] border border-stamp-verified/15 rounded-lg"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                  />
                )}
                <item.icon
                  className={cn(
                    "shrink-0 h-[18px] w-[18px] transition-colors relative z-10",
                    isActive ? "text-stamp-verified" : "text-text-muted group-hover:text-text-secondary"
                  )}
                />
                {!collapsed && <span className="relative z-10">{item.name}</span>}
                {item.name === "Notifications" && unreadCount > 0 && (
                  <div className={cn("absolute bg-ink-900 rounded-full", collapsed ? "top-2 right-2 h-2 w-2" : "right-3 flex items-center justify-center h-5 min-w-[20px] px-1.5 text-[10px] font-bold text-paper-0")} >
                    {!collapsed && unreadCount}
                  </div>
                )}
                {isActive && !collapsed && item.name !== "Notifications" && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-ink-900 relative z-10" />
                )}
              </Link>
            );
          })}

          {isAdmin && (
            <>
              <div className="my-4 border-t border-rule" />
              {!collapsed && (
                <div className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">
                  Admin
                </div>
              )}
              {ADMIN_ITEMS.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "group relative flex items-center rounded-lg text-sm font-medium transition-all duration-200",
                      collapsed ? "justify-center h-10 w-10 mx-auto" : "px-3 py-2.5 gap-3",
                      isActive
                        ? "text-text-primary"
                        : "text-text-secondary hover:text-text-primary hover:bg-paper-0/[0.03]"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "shrink-0 h-[18px] w-[18px] transition-colors",
                        isActive ? "text-stamp-verified" : "text-text-muted group-hover:text-text-secondary"
                      )}
                    />
                    {!collapsed && <span>{item.name}</span>}
                  </Link>
                );
              })}
            </>
          )}

          <div className="my-4 border-t border-rule" />

          {!collapsed && (
            <div className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">
              Account
            </div>
          )}

          <Link
            href={user?.username ? `/profile/${user.username}` : "/profile/me"}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "group flex items-center rounded-lg text-sm font-medium text-text-secondary transition-all hover:text-text-primary hover:bg-paper-0/[0.03]",
              collapsed ? "justify-center h-10 w-10 mx-auto" : "px-3 py-2.5 gap-3"
            )}
          >
            <User className="shrink-0 h-[18px] w-[18px] text-text-muted group-hover:text-text-secondary" />
            {!collapsed && <span>Profile</span>}
          </Link>
        </nav>

        {/* User Card */}
        <div className="p-3 border-t border-rule">
          {collapsed ? (
            <div className="flex justify-center">
              <Avatar
                name={user?.name as string ?? "User"}
                tier={(user?.rankTier as string ?? "Bronze") as "Bronze" | "Silver" | "Gold" | "Platinum" | "Elite"}
                size="sm"
              />
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-rule bg-paper-1/50 p-3 hover:border-ink-300 transition-colors">
              <Avatar
                name={user?.name as string ?? "User"}
                tier={(user?.rankTier as string ?? "Bronze") as "Bronze" | "Silver" | "Gold" | "Platinum" | "Elite"}
                size="sm"
              />
              <div className="flex-1 flex flex-col min-w-0">
                <span className="truncate text-sm font-medium text-text-primary">
                  {user?.name as string ?? "Builder"}
                </span>
                <span className="truncate text-[10px] text-text-muted font-mono">
                  {user?.rankTier as string ?? "Bronze"} • {user?.points as number ?? 0} pts
                </span>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="text-text-muted hover:text-[#E5484D] cursor-pointer transition-colors shrink-0"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
