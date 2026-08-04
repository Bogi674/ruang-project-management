"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarDays, FolderKanban, Bell, Plus,
  ChevronRight, ChevronDown, LogOut, Menu, X, User,
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Project } from "@/types";

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [projects, setProjects] = useState<Project[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetch("/api/projects")
        .then((r) => r.json())
        .then(setProjects)
        .catch(() => {});
    }
  }, [session]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground" />
      </div>
    );
  }

  if (!session) return null;

  const toggleProject = (id: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col border-r border-border bg-card transition-all duration-200",
          sidebarOpen ? "w-60" : "w-0 overflow-hidden"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 h-14 border-b border-border shrink-0">
          <span className="font-bold text-lg tracking-tight">Ruang</span>
        </div>

        <ScrollArea className="flex-1 py-2">
          {/* Nav */}
          <nav className="px-2 space-y-0.5">
            <NavLink href="/today" icon={<CalendarDays className="h-4 w-4" />} active={pathname === "/today"}>
              Today
            </NavLink>
            <NavLink
              href="/projects"
              icon={<FolderKanban className="h-4 w-4" />}
              active={pathname === "/projects"}
            >
              All Projects
            </NavLink>
          </nav>

          {/* Projects */}
          <div className="mt-4 px-2">
            <div className="flex items-center justify-between px-2 mb-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Projects
              </span>
              <Link href="/projects/new">
                <button className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </Link>
            </div>

            <div className="space-y-0.5">
              {projects.map((project) => {
                const expanded = expandedProjects.has(project.id);
                const isActive = pathname.startsWith(`/projects/${project.id}`);
                return (
                  <div key={project.id}>
                    <div
                      className={cn(
                        "flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer hover:bg-accent transition-colors text-sm",
                        isActive && "bg-accent"
                      )}
                    >
                      <button
                        onClick={() => toggleProject(project.id)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {expanded ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <div
                        className="h-3 w-3 rounded-sm shrink-0"
                        style={{ backgroundColor: project.color }}
                      />
                      <Link
                        href={`/projects/${project.id}`}
                        className="flex-1 truncate font-medium"
                      >
                        {project.name}
                      </Link>
                    </div>
                    {expanded && (
                      <div className="ml-8 mt-0.5 space-y-0.5">
                        <Link
                          href={`/projects/${project.id}`}
                          className={cn(
                            "block px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors",
                            pathname === `/projects/${project.id}` && "text-foreground bg-accent"
                          )}
                        >
                          List View
                        </Link>
                        <Link
                          href={`/projects/${project.id}/settings`}
                          className={cn(
                            "block px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors",
                            pathname === `/projects/${project.id}/settings` && "text-foreground bg-accent"
                          )}
                        >
                          Settings
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })}

              {projects.length === 0 && (
                <p className="text-xs text-muted-foreground px-2 py-1">No projects yet</p>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* User */}
        <div className="border-t border-border p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md hover:bg-accent transition-colors">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={session.user.image || ""} />
                  <AvatarFallback className="text-xs">
                    {getInitials(session.user.name || "U")}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm truncate flex-1 text-left">{session.user.name}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-48">
              <DropdownMenuItem asChild>
                <Link href="/settings/profile" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => signOut({ callbackUrl: "/auth/signin" })}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Topbar */}
        <header className="h-14 border-b border-border flex items-center px-4 gap-3 shrink-0 bg-background">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="p-1.5 rounded hover:bg-accent transition-colors"
          >
            {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
          <div className="flex-1" />
          <button className="p-1.5 rounded hover:bg-accent transition-colors relative">
            <Bell className="h-4 w-4" />
          </button>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

function NavLink({
  href,
  icon,
  active,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors",
        active
          ? "bg-accent text-foreground font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-accent"
      )}
    >
      {icon}
      {children}
    </Link>
  );
}
