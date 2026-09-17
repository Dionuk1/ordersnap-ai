import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo.svg";
import { cn } from "@/lib/utils";
import {
  ClipboardList,
  Ellipsis,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, adminOnly: false },
  { to: "/catalog", label: "Katalogu", icon: Package, adminOnly: false },
  { to: "/orders/new", label: "Porosi e Re", icon: Sparkles, adminOnly: false },
  { to: "/orders", label: "Porositë", icon: ClipboardList, adminOnly: false },
  { to: "/more", label: "Më shumë", icon: Ellipsis, adminOnly: false },
];

const MORE_NAV = [
  { to: "/settings", label: "Cilësimet", icon: Settings, adminOnly: true },
  { to: "/admin", label: "Admin Panel", icon: ShieldCheck, adminOnly: true },
  { to: "/settings", label: "Stafi", icon: Users, adminOnly: true },
];

/** Mobile bottom-nav excludes the current page's own entry dupes. */
const MOBILE_NAV = NAV;

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const role = user?.role ?? "member";
  const isAdmin = role === "admin";

  const navItems = NAV.filter((item) => !item.adminOnly || isAdmin);

  const isActive = (to: string) => {
    if (to === "/admin") return location.pathname.startsWith("/admin");
    if (to === "/more") return location.pathname.startsWith("/more");
    if (to === "/orders/new") return location.pathname === "/orders/new";
    if (to === "/catalog") {
      return location.pathname.startsWith("/catalog");
    }
    if (to === "/orders") {
      return (
        location.pathname === "/orders" ||
        (location.pathname.startsWith("/orders") &&
          location.pathname !== "/orders/new")
      );
    }
    if (to === "/settings") {
      // "Më shumë" is active on settings + any secondary pages
      return (
        location.pathname === "/settings" ||
        location.pathname.startsWith("/settings")
      );
    }
    return location.pathname === to;
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const SidebarContent = (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link to="/dashboard" className="flex items-center gap-3 px-2 py-1">
        <img src={logo} alt="OrderSnap AI" className="size-9 rounded-lg" />
        <div>
          <div className="text-sm font-semibold tracking-tight">OrderSnap AI</div>
          <div className="text-[11px] text-muted-foreground">Menaxhim me AI</div>
        </div>
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map((item, idx) => {
          const Icon = item.icon;
          return (
            <Link
              key={`${item.to}-${idx}`}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive(item.to)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}

        {/* Admin-only secondary section */}
        {isAdmin && (
          <>
            <div className="mt-3 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Administrata
            </div>
            {MORE_NAV.map((item, idx) => {
              const Icon = item.icon;
              return (
                <Link
                  key={`more-${item.to}-${idx}`}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive(item.to) && item.label !== "Stafi"
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      <div className="rounded-xl border bg-muted/40 p-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold uppercase text-primary">
            {(user?.name ?? user?.email ?? "U").slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium">
              {user?.name ?? user?.email ?? "Përdorues"}
            </div>
            <span
              className={cn(
                "mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                "bg-slate-100 text-blue-700 dark:bg-slate-800 dark:text-blue-400",
              )}
            >
              Administrator i Kompanisë
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 w-full justify-start text-muted-foreground"
          onClick={handleSignOut}
        >
          <LogOut className="mr-2 size-3.5" />
          Dilni
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r bg-card lg:block">
        <div className="sticky top-0 h-screen">{SidebarContent}</div>
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-64 border-r bg-card shadow-xl">
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2"
              onClick={() => setMobileOpen(false)}
            >
              <X className="size-4" />
            </Button>
            {SidebarContent}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile topbar */}
        <header className="flex h-14 items-center gap-3 border-b bg-card/80 px-4 backdrop-blur lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-5" />
          </Button>
          <img src={logo} alt="OrderSnap AI" className="size-7 rounded-md" />
          <span className="text-sm font-semibold">OrderSnap AI</span>
        </header>

        <main className="flex-1 p-4 pb-24 sm:p-6 sm:pb-6 lg:p-8 lg:pb-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>

        {/* Mobile bottom navigation */}
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-md items-stretch justify-between px-2 py-1.5">
            {MOBILE_NAV.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-medium transition-colors",
                    active
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-8 items-center justify-center rounded-lg transition-colors",
                      active && "bg-primary/10",
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
