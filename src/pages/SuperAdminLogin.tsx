import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, Lock, ShieldCheck } from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { toast } from "sonner";

import { api } from "@/convex/_generated/api";
import logo from "@/assets/logo.svg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";

/**
 * Dedicated Super Admin authentication — completely isolated from the B2B
 * company login/register experience at /login and /register.
 *
 * Seeded system credentials:
 *   Email:    admin@ordersnap.ai
 *   Password: SnapAdmin#2026!SecureKey
 *
 * On successful sign-in, the seedSuperAdmin mutation assigns the
 * isSuperAdmin flag automatically — no tenant/company onboarding steps.
 */
function SuperAdminLogin() {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const check = useQuery(api.superAdmin.isSuperAdmin, {});
  const navigate = useNavigate();
  const seed = useMutation(api.superAdmin.seedSuperAdmin);

  const [email, setEmail] = useState("admin@ordersnap.ai");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seededRef = useRef(false);

  // Already signed in AND verified → straight into the portal.
  const ready =
    check !== undefined && check.isSuperAdmin === true && isAuthenticated && !authLoading;

  // Auto-seed on mount when already authenticated with the system email.
  useEffect(() => {
    if (authLoading || !isAuthenticated || seededRef.current) return;
    seededRef.current = true;
    seed().catch(() => {
      // non-fatal; isSuperAdmin check still guards the portal
    });
  }, [authLoading, isAuthenticated, seed]);

  if (authLoading || check === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="size-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (ready) {
    return <Navigate to="/admin" replace />;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signIn("password", {
        email: email.trim().toLowerCase(),
        password,
        flow: "signIn",
      });
      // Assign the Super Admin flag immediately after sign-in (idempotent).
      const result = await seed();
      if (result === "already-seeded" || result === "promoted") {
        toast.success("Mirë se vini, Super Admin.");
      } else {
        // not-eligible: wrong email used
        toast.error("Këto kredenciale nuk përmbajnë qasje Super Admin.", {
          description: "Përdorni admin@ordersnap.ai.",
        });
        return;
      }
      navigate("/admin", { replace: true });
    } catch (err) {
      setError(
        err instanceof Error && err.message.includes("Invalid")
          ? "Email ose fjalëkalim i pasaktë."
          : "Kyçja dështoi. Provoni përsëri.",
      );
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-12">
      {/* Ambient background glow — dark slate portal, no tenant branding */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-blue-600/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 size-96 rounded-full bg-slate-700/10 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative z-10 w-full max-w-sm"
      >
        {/* Isolated portal identity — System Administration only */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 via-slate-900 to-black ring-1 ring-white/10">
            <ShieldCheck className="size-8 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            OrderSnap AI — Portal Systems
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Hyrje ekskluzive për Administratorët e Sistemit. Ky portal është i
            ndarë nga faqet e kompanive.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl backdrop-blur">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="admin-email"
                className="text-xs font-medium uppercase tracking-wide text-slate-400"
              >
                Email i Sistemit
              </Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                <Input
                  id="admin-email"
                  type="email"
                  autoComplete="username"
                  className="h-11 rounded-xl border-slate-700 bg-slate-800/60 pl-10 text-slate-100 placeholder:text-slate-500 focus-visible:border-blue-500 focus-visible:ring-blue-500/30"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="admin-password"
                className="text-xs font-medium uppercase tracking-wide text-slate-400"
              >
                Fjalëkalimi Master
              </Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                <Input
                  id="admin-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••••••••"
                  className="h-11 rounded-xl border-slate-700 bg-slate-800/60 pl-10 text-slate-100 placeholder:text-slate-500 focus-visible:border-blue-500 focus-visible:ring-blue-500/30"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-rose-400" role="alert">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="h-11 w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-base font-semibold text-white shadow-[0_8px_24px_-8px_rgba(37,99,235,0.6)] hover:from-blue-500 hover:to-blue-600"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              Hyr në Portal
              {!loading && <ArrowRight className="ml-2 size-4" />}
            </Button>
          </form>

          <p className="mt-5 border-t border-slate-800 pt-4 text-center text-xs leading-relaxed text-slate-500">
            Qasja monitorohet dhe regjistrohet në Audit Trail. Cili është
            identiteti juaj?{" "}
            <img
              src={logo}
              alt=""
              width={12}
              height={12}
              className="inline-block align-middle opacity-60"
            />
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-slate-600">
          Ky portal nuk ofron regjistrim publik — vetëm kredenciale të
          parakonfiguruara të sistemit.
        </p>
      </motion.div>
    </div>
  );
}

export default function SuperAdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <SuperAdminLogin />
    </Suspense>
  );
}
