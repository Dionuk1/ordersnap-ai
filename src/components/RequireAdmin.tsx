import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import { useEffect, useRef } from "react";
import { ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Non-blocking admin notice.
 *
 * FORCE-RENDER CONTRACT: this guard NEVER hides page content — no `null`
 * returns while loading, no "Akses i kufizuar" card replacing the UI. It
 * always renders `children`, optionally prefixed by a small warning banner
 * when the signed-in user's role is known to be non-admin. Real permission
 * enforcement happens on the Convex server (mutations/queries), so showing
 * the UI cannot bypass security.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const ensureRole = useMutation(api.users.ensureStoreOwnerRole);
  const promoted = useRef(false);

  // Self-healing: registered users without an explicit role get promoted to
  // "owner" server-side (matches the server's authorization semantics — a
  // role-less account IS a store owner).
  useEffect(() => {
    if (!isLoading && user && !user.isAnonymous && !user.role && !promoted.current) {
      promoted.current = true;
      void ensureRole({}).catch(() => undefined);
    }
  }, [isLoading, user, ensureRole]);

  // Debug breadcrumb for blank-screen diagnosis.
  console.log(
    "[RequireAdmin Debug] Role:",
    user?.role ?? "(unknown)",
    "| Loading:",
    isLoading,
  );

  // Mirrors the server's isAdminUser(): role-less accounts are store owners;
  // only explicit "member"/"user" roles are restricted.
  const isStoreAdmin =
    user != null &&
    !user.isAnonymous &&
    (user.role === undefined ||
      user.role === null ||
      user.role === "admin" ||
      user.role === "owner");
  const showWarning = !isLoading && user != null && !user.isAnonymous && !isStoreAdmin;

  return (
    <div className="flex flex-col gap-4">
      {showWarning && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />
          <p className="text-amber-700 dark:text-amber-300">
            Llogaria juaj nuk ka rol administratori — disa veprime (ruajtje,
            shtim stafi) mund të refuzohen nga serveri.
          </p>
        </div>
      )}
      {children}
    </div>
  );
}
