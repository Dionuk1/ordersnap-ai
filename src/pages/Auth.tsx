import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  Building2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
} from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useSearchParams,
} from "react-router";
import { toast } from "sonner";

import { api } from "@/convex/_generated/api";
import logo from "@/assets/logo.svg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";

interface AuthProps {
  redirectAfterAuth?: string;
}

/** "flladituks" | "FlladituKS" | full URL → "flladituks" */
function normalizeTenantSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split(/[/?#]/)[0]
    .replace(/.*tenant=/, "")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+|-+$/g, "");
}

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/dashboard",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const boundRef = useRef(false);

  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );

  // ── 1. Multi-tenant URL routing: /login?tenant={slug} ──────────────────
  const tenantSlugParam = searchParams.get("tenant");
  const normalizedSlug = tenantSlugParam ? normalizeTenantSlug(tenantSlugParam) : "";

  const tenant = useQuery(
    api.tenants.getBySlug,
    normalizedSlug ? { slug: normalizedSlug } : "skip",
  );
  const tenantResolved = normalizedSlug !== "" && tenant !== undefined;
  const isTenantMode = normalizedSlug !== "";
  const tenantName = tenant?.name ?? null;
  const tenantInitials = tenantName
    ? tenantName
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "";
  const tenantSubtitle = tenant?.subtitle ?? "Hyr në llogarinë tënde";
  const tenantLogoUrl = tenant?.logoUrl ?? null;
  const accent = tenant?.accentColor ?? "#7c5cfc";

  // ── 2. Data scope injection: bind workspace to resolved tenant ─────────
  const setActiveTenant = useMutation(api.tenants.setActiveTenant);
  useEffect(() => {
    if (!isAuthenticated || !tenantResolved || !tenant?._id || boundRef.current)
      return;
    boundRef.current = true;
    setActiveTenant({ tenantId: tenant._id }).catch((err) => {
      toast.error(
        err instanceof Error ? err.message : "Lidhja me kompaninë dështoi.",
      );
    });
  }, [isAuthenticated, tenantResolved, tenant?._id, setActiveTenant]);

  // Seed the demo tenant once so /login?tenant=flladituks works out of the box.
  const ensureDemoTenant = useMutation(api.tenants.ensureDemoTenant);
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    ensureDemoTenant().catch(() => {
      // Non-fatal — an invalid tenant slug still falls back gracefully.
    });
  }, [ensureDemoTenant]);

  // ── 3. Invalid slug → friendly toast + graceful fallback ──────────────
  const fallbackDoneRef = useRef(false);
  useEffect(() => {
    if (
      isTenantMode &&
      tenantResolved &&
      tenant === null &&
      !fallbackDoneRef.current
    ) {
      fallbackDoneRef.current = true;
      toast.error("Kompania nuk u gjet", {
        description: "Dukeju kthyer në hyrjen standarde…",
      });
      const t = setTimeout(() => {
        navigate("/login", { replace: true });
      }, 1400);
      return () => clearTimeout(t);
    }
  }, [isTenantMode, tenantResolved, tenant, navigate]);

  // Sign-in page auto-redirect when already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect, { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("password", {
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        flow: "signIn",
      });
      // Bind the active workspace to the resolved tenant before redirecting.
      if (tenant?._id) {
        try {
          await setActiveTenant({ tenantId: tenant._id });
        } catch {
          // Non-fatal: workspace binding is a safety net, not a blocker.
        }
      }
      navigate(redirect);
    } catch (err) {
      setError(
        err instanceof Error && err.message.includes("Invalid")
          ? "Email ose fjalëkalim i pasaktë."
          : "Kyçja dështoi. Provoni përsëri.",
      );
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn("google");
    } catch {
      setError(
        "Kyçja me Google nuk është e konfiguruar. Përdorni email & fjalëkalim.",
      );
      setIsLoading(false);
    }
  };

  const passwordFields = (idPrefix: string) => (
    <>
      <div className="space-y-2">
        <Label
          htmlFor={`${idPrefix}-email`}
          className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
        >
          Email Adresa
        </Label>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={`${idPrefix}-email`}
            name="email"
            type="email"
            autoComplete="email"
            placeholder="emri@shembull.com"
            className="h-11 rounded-xl pl-10"
            disabled={isLoading}
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label
          htmlFor={`${idPrefix}-password`}
          className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
        >
          Fjalëkalimi
        </Label>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={`${idPrefix}-password`}
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            className="h-11 rounded-xl pl-10 pr-10"
            disabled={isLoading}
            required
            minLength={8}
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            tabIndex={-1}
            aria-label={
              showPassword ? "Fshih fjalëkalimin" : "Shfaq fjalëkalimin"
            }
          >
            {showPassword ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        </div>
      </div>
    </>
  );

  const checkbox = (
    <label
      htmlFor="remember-me"
      className="flex cursor-pointer select-none items-center gap-2 text-sm text-foreground/80"
    >
      <input
        id="remember-me"
        type="checkbox"
        checked={rememberMe}
        onChange={(e) => setRememberMe(e.target.checked)}
        className="size-4 cursor-pointer accent-primary"
      />
      Më mbaj mend
    </label>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          {/* Branded tenant header replaces the generic logo + tabs view */}
          {isTenantMode ? (
            <motion.div
              key={normalizedSlug}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="mb-8 flex flex-col items-center text-center"
            >
              {tenantResolved && tenant ? (
                <>
                  {tenantLogoUrl ? (
                    <img
                      src={tenantLogoUrl}
                      alt={tenantName ?? "Logo"}
                      width={64}
                      height={64}
                      className="mb-4 size-16 rounded-2xl object-cover"
                    />
                  ) : (
                    <div
                      className="mb-4 flex size-16 items-center justify-center rounded-2xl text-xl font-bold tracking-tight text-white"
                      style={{
                        backgroundColor: accent,
                        boxShadow: `0 12px 32px -12px ${accent}80`,
                      }}
                    >
                      {tenantInitials}
                    </div>
                  )}
                  <h1 className="text-3xl font-bold tracking-tight">
                    {tenantName}
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {tenantSubtitle}
                  </p>
                </>
              ) : (
                <Loader2 className="my-4 size-8 animate-spin text-muted-foreground" />
              )}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="mb-8 flex flex-col items-center text-center"
            >
              <Link to="/">
                <img
                  src={logo}
                  alt="OrderSnap AI"
                  width={64}
                  height={64}
                  className="mb-4 size-16 rounded-2xl"
                />
              </Link>
              <h1 className="text-3xl font-bold tracking-tight">
                Mirë se u ktheve
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Kyçu për të menaxhuar porositë, tracking dhe integrimet me
                postat.
              </p>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08, ease: "easeOut" }}
            className="rounded-2xl border bg-card p-6"
          >
            <form onSubmit={handleSignIn} className="space-y-4">
              {passwordFields("login")}

              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}

              <div className="flex items-center justify-between pt-1">
                {checkbox}
                <button
                  type="button"
                  onClick={() =>
                    toast.info(
                      "Kontaktoni administratorin e kompanisë suaj për të rivendosur fjalëkalimin.",
                    )
                  }
                  className="cursor-pointer text-sm text-muted-foreground transition-colors hover:text-primary"
                >
                  Keni harruar fjalëkalimin?
                </button>
              </div>

              {/* Tenant slug resolver — only on the global login */}
              {!isTenantMode && <TenantLinkSection />}

              <Button
                type="submit"
                className="h-11 w-full rounded-xl bg-primary text-base font-semibold"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
                Hyr në Llogari
              </Button>
            </form>

            {/* Bottom "back to normal login" link in tenant mode */}
            {isTenantMode && (
              <div className="mt-5 border-t pt-4 text-center">
                <button
                  type="button"
                  onClick={() => {
                    const params = new URLSearchParams(searchParams);
                    params.delete("tenant");
                    setSearchParams(params, { replace: true });
                  }}
                  className="cursor-pointer text-sm text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
                >
                  ← Faqja e zakonshme e hyrjes
                </button>
              </div>
            )}
          </motion.div>

          <p
            className="mt-6 text-center text-xs text-muted-foreground"
          >
            {isTenantMode ? (
              <>
                Mundësuar nga{" "}
                <Link
                  to="/"
                  className="font-medium underline decoration-border underline-offset-2 hover:text-foreground"
                >
                  OrderSnap AI
                </Link>
              </>
            ) : (
              "Mundësuar nga OrderSnap AI"
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

/** "Hyr nga linku i dedikuar i kompanisë suaj" — slug resolver card (screenshot 1). */
function TenantLinkSection() {
  const [slugInput, setSlugInput] = useState("");
  const navigate = useNavigate();
  const previewUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/login?tenant=flladituks`
      : "https://dergesa.app/login?tenant=flladituks";

  const handleGo = () => {
    const slug = normalizeTenantSlug(slugInput);
    if (!slug) {
      toast.error("Shkruani slug-un e kompanisë (p.sh. flladituks).");
      return;
    }
    navigate(`/login?tenant=${encodeURIComponent(slug)}`);
  };

  return (
    <motion.div
      layout
      initial={false}
      className="rounded-xl border bg-muted/40 p-4"
    >
      <p className="text-sm font-medium text-foreground/90">
        Hyr nga linku i dedikuar i kompanisë suaj:
      </p>
      <div className="relative mt-3">
        <Building2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={slugInput}
          onChange={(e) => setSlugInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleGo();
            }
          }}
          placeholder="flladituks"
          className="h-10 rounded-lg pl-9 text-sm"
          aria-label="Slug i kompanisë"
        />
      </div>
      <Button
        type="button"
        className="mt-2.5 h-10 w-full rounded-lg bg-blue-600 text-sm font-medium hover:bg-blue-600/90"
        onClick={handleGo}
      >
        Hyr nga linku i kompanisë →
      </Button>
      <button
        type="button"
        onClick={() => navigate("/login?tenant=flladituks")}
        className="mt-2 w-full cursor-pointer text-center text-[11px] text-muted-foreground underline decoration-border underline-offset-2 transition-colors hover:text-foreground"
      >
        {previewUrl}
      </button>
    </motion.div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense fallback={null}>
      <Auth {...props} />
    </Suspense>
  );
}
