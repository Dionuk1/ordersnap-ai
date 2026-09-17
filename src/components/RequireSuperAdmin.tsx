import { useQuery, useMutation } from "convex/react";
import { Navigate } from "react-router";
import { toast } from "sonner";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";

/**
 * Guard for the Super Admin Portal (/admin).
 *
 * - Unauthenticated → redirect to /login with "Akses i paautorizuar" toast.
 * - Signed in but not a verified Super Admin (is_super_admin flag) → same.
 * - While signed in, attempts to claim the seeded super-admin identity
 *   (admin@ordersnap.ai) on first visit.
 */
export function RequireSuperAdmin({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  const check = useQuery(api.superAdmin.isSuperAdmin, {});
  const seed = useMutation(api.superAdmin.seedSuperAdmin);
  const seededRef = useRef(false);
  const warnedRef = useRef(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated && !seededRef.current) {
      seededRef.current = true;
      seed().catch(() => {
        // non-fatal
      });
    }
  }, [isLoading, isAuthenticated, seed]);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated && !warnedRef.current) {
      warnedRef.current = true;
      toast.error("Akses i paautorizuar", {
        description: "Duhet të kyçeni si Super Admin për të vazhduar.",
      });
    }
  }, [isLoading, isAuthenticated]);

  if (isLoading || check === undefined) return null;

  if (!isAuthenticated) {
    return <Navigate to="/login?returnTo=/admin" replace />;
  }

  // Give the seed mutation one tick to promote the eligible email before
  // showing the unauthorized state.
  if (check.isSuperAdmin === false) {
    if (check.email && check.email.trim().toLowerCase() === "admin@ordersnap.ai") {
      return null; // seeding in flight
    }
    if (!warnedRef.current) {
      warnedRef.current = true;
      toast.error("Akses i paautorizuar", {
        description: "Vetëm Super Adminët kanë qasje në këtë portal.",
      });
    }
    return <Navigate to="/login?returnTo=/admin" replace />;
  }

  return children;
}
