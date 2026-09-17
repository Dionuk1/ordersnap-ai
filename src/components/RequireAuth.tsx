import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!isAuthenticated) {
    const returnTo = `${location.pathname}${location.search}`;
    const params = new URLSearchParams({
      returnTo,
    });
    // Preserve tenant context across the guard redirect: a branded session
    // timeout must land back on the company's /login?tenant={slug} page, not
    // silently downgrade to the generic login.
    const tenant = new URLSearchParams(location.search).get("tenant");
    if (tenant) params.set("tenant", tenant);
    return (
      <Navigate to={`/login?${params.toString()}`} replace />
    );
  }

  return children;
}
