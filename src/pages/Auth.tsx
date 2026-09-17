import { useMutation, useQuery } from "convex/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Building2,
  Check,
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

/**
 * 2-Step Tenant Verification gate.
 *
 * A company-bound admin on root /login MUST authenticate via their branded
 * /login?tenant={slug} page — never directly. The gate below is derived from
 * the reactive `resolveByEmail` query (NOT from state) so it closes before
 * the first keystroke/Enter can submit: a state-only flag would leave a race
 * window where direct auth executes before the lookup resolves.
 */
const BLOCK_LOGIN_MESSAGE =
  "Përdorni linkun e dedikuar të kompanisë suaj për hyrje.";

/** True when the typed email resolves to a registered company tenant. */
function isTenantBound(tenant: { slug: string; name: string } | null | undefined): boolean {
  return Boolean(tenant?.slug);
}

/**
 * Demo-tenant seeding is invoked at most once per page load (module flag
 * survives component remounts) and the mutation itself is idempotent —
 * StrictMode double-invoke cannot create duplicates or loop.
 */
let demoTenantSeededThisSession = false;

interface AuthProps {
  redirectAfterAuth?: string;
  initialView?: "login" | "register";
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

/**
 * Extracts display initials from a company name:
 * "FlladituKS" → "FL" (leading capital-pairs win over word-splitting),
 * "OrderSnap AI" → "OA", "flladituks shop" → "FS".
 */
function extractInitials(name: string): string {
  const clean = name.trim();
  if (!clean) return "";
  // CamelCase / mixed-case pairs (FlladituKS → F, K)
  const caps = clean.match(/[A-Z]/g);
  if (caps && caps.length >= 2) {
    return (caps[0] + caps[1]).toUpperCase();
  }
  // Fall back to first letter of each word, then first two letters.
  const words = clean.split(/[\s_-]+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
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

function Auth({ redirectAfterAuth, initialView }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const boundRef = useRef(false);

  // Shared email so it survives switching global ⇄ tenant login (requirement 3).
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Password reset flow: "forgot" = request code by email, "reset" = enter
  // the 6-digit code + the new password (typed twice).
  const [view, setView] = useState<
    "login" | "forgot" | "reset" | "register"
  >(initialView ?? "login");
  // Company registration (sign-up) fields.
  const [companyName, setCompanyName] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirm, setRegisterConfirm] = useState("");
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const createTenant = useMutation(api.tenants.upsert);
  const [resetCode, setResetCode] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

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
  const tenantInitials = tenantName ? extractInitials(tenantName) : "";
  const tenantSubtitle = tenant?.subtitle ?? "Hyr në llogarinë tënde";
  const tenantLogoUrl = tenant?.logoUrl ?? null;

  // ── Dynamic tenant lookup by typed email (requirement 1) ────────────────
  // Clean the input BEFORE the lookup: stray whitespace (autofill, mobile
  // keyboards) must not defeat the tenant match.
  const emailTrimmed = email.trim().toLowerCase();
  const emailTenant = useQuery(
    api.tenants.resolveByEmail,
    !isTenantMode && emailTrimmed.includes("@") && emailTrimmed.length > 5
      ? { email: emailTrimmed }
      : "skip",
  );

  // 2-Step tenant verification: the binding is DERIVED from the live query
  // result (undefined = still resolving; object = tenant-bound; null = no
  // company). No setState race: the moment the tenant exists in the DB, the
  // gate below is closed — even if the admin hits Enter immediately after
  // typing. Unknown emails (null) fall through to standard auth.
  const hasCompanyTenant = isTenantBound(emailTenant);
  const resolvedStore = hasCompanyTenant
    ? { slug: emailTenant!.slug, name: emailTenant!.name }
    : null;
  // A tenant lookup is genuinely pending only while a plausible email has
  // been typed AND the query has not answered yet. With no/partial email the
  // query is "skip" (undefined) — that must NOT block sign-in.
  const tenantLookupPending =
    !isTenantMode &&
    emailTrimmed.includes("@") &&
    emailTrimmed.length > 5 &&
    emailTenant === undefined;

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
  useEffect(() => {
    if (demoTenantSeededThisSession) return;
    demoTenantSeededThisSession = true;
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

  // Hand-off pre-fill from the Company Link Card (?tenant=…&email=…&pw=…):
  // consume the credentials into state once, then scrub them from the
  // address bar so they never linger in browser history.
  const prefilledRef = useRef(false);
  useEffect(() => {
    if (prefilledRef.current) return;
    const preEmail = searchParams.get("email");
    const prePw = searchParams.get("pw");
    if (!preEmail && !prePw) return;
    prefilledRef.current = true;
    if (preEmail) setEmail(preEmail);
    if (prePw) setPassword(prePw);
    const params = new URLSearchParams(searchParams);
    params.delete("email");
    params.delete("pw");
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  // Sign-in page auto-redirect when already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect, { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // ── HARD 2-step gate: block ALL direct auth on root /login while the
    // email is tenant-bound (or while its tenant lookup is still resolving —
    // we never authenticate blindly during that window). This fires on both
    // click and Enter-key submission.
    if (!isTenantMode && (hasCompanyTenant || tenantLookupPending)) {
      event.stopPropagation();
      toast.info(BLOCK_LOGIN_MESSAGE, {
        description: hasCompanyTenant
          ? "Hyr nga linku i kompanisë më poshtë."
          : "Duke verifikuar linkun e kompanisë…",
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await signIn("password", {
        email: emailTrimmed,
        password,
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

  /**
   * Company Admin registration: creates the auth account and initializes a
   * new tenant store (slug derived from the company name) in one flow.
   */
  const handleSignUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyName.trim()) {
      setRegisterError("Shkruani emrin e kompanisë.");
      return;
    }
    // Trim BOTH values before comparing — raw values can carry stray
    // whitespace (autofill/mobile keyboards) and false-negative the match.
    if (registerPassword.trim() !== registerConfirm.trim()) {
      setRegisterError("Fjalëkalimet nuk përputhen.");
      return;
    }
    if (registerPassword.trim().length < 8) {
      setRegisterError("Fjalëkalimi duhet të ketë së paku 8 karaktere.");
      return;
    }
    setRegisterLoading(true);
    setRegisterError(null);

    // Super Admin accounts are provisioned exclusively via /admin/login —
    // never through the public company registration form.
    if (emailTrimmed === "admin@ordersnap.ai") {
      setRegisterError(
        "Kjo email i përket Super Adminit. Përdorni /admin/login për hyrje.",
      );
      setRegisterLoading(false);
      return;
    }

    try {
      // 1) Create the auth account (Company Admin).
      await signIn("password", {
        email: emailTrimmed,
        password: registerPassword.trim(),
        flow: "signUp",
      });
      // 2) Initialize the tenant store with a slug derived from the name.
      const slug = companyName
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "")
        .slice(0, 30);
      await createTenant({
        slug,
        name: companyName.trim(),
        ownerEmail: emailTrimmed,
        isActive: true,
      });
      toast.success("Llogaria e kompanisë u krijua. Mirë se vini!");
      navigate(redirect);
    } catch (err) {
      setRegisterError(
        err instanceof Error && err.message.includes("already")
          ? "Ky email është i regjistruar tashmë. Provoni të kyçeni."
          : err instanceof Error
            ? err.message
            : "Regjistrimi dështoi. Provoni përsëri.",
      );
      setRegisterLoading(false);
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

  const handleRequestReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setResetLoading(true);
    setResetError(null);
    try {
      await signIn("password", { flow: "reset", email: emailTrimmed });
      toast.success("Kodi i rivendosjes u dërgua në emailin tuaj.");
      setView("reset");
    } catch {
      // Never reveal whether the email exists.
      toast.success(
        "Nëse emaili ekziston, kodi i rivendosjes u dërgua.",
      );
      setView("reset");
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Trim BOTH values — stray whitespace must not false-negative the match.
    if (resetPassword.trim() !== resetConfirm.trim()) {
      setResetError("Fjalëkalimet nuk përputhen.");
      return;
    }
    const cleanNewPassword = resetPassword.trim();
    setResetLoading(true);
    setResetError(null);
    try {
      await signIn("password", {
        flow: "reset-verification",
        email: emailTrimmed,
        code: resetCode.trim(),
        newPassword: cleanNewPassword,
      });
      toast.success("Fjalëkalimi u ndryshua me sukses.");
      navigate(redirect);
    } catch (err) {
      setResetError(
        err instanceof Error && err.message.includes("Invalid")
          ? "Kodi është i pasaktë ose ka skaduar."
          : "Rivendosja dështoi. Provoni përsëri.",
      );
      setResetLoading(false);
    }
  };

  const emailField = (id: string) => (
    <div className="space-y-2">
      <Label
        htmlFor={id}
        className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
      >
        Email Adresa
      </Label>
      <div className="relative">
        <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          name="email"
          type="email"
          autoComplete="email"
          placeholder="emri@shembull.com"
          className="h-11 rounded-xl border-border/80 pl-10 focus-visible:border-blue-500 focus-visible:ring-blue-500/30"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
          required
        />
      </div>
    </div>
  );

  const passwordField = (id: string, autoComplete: string) => (
    <div className="space-y-2">
      <Label
        htmlFor={id}
        className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
      >
        Fjalëkalimi
      </Label>
      <div className="relative">
        <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder="••••••••"
          className="h-11 rounded-xl border-border/80 pl-10 pr-10 focus-visible:border-blue-500 focus-visible:ring-blue-500/30"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
        className="size-4 cursor-pointer accent-blue-600"
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
                      className="mb-4 size-16 rounded-2xl object-cover ring-1 ring-white/10"
                    />
                  ) : (
                    <div
                      className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 via-slate-900 to-black text-xl font-bold tracking-tight text-white ring-1 ring-white/10"
                      style={{
                        boxShadow:
                          "0 12px 32px -12px rgba(37, 99, 235, 0.55)",
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
                <div
                  className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 via-slate-900 to-black ring-1 ring-white/10"
                  style={{
                    boxShadow: "0 12px 32px -12px rgba(37, 99, 235, 0.55)",
                  }}
                >
                  <img
                    src={logo}
                    alt="OrderSnap AI"
                    width={44}
                    height={44}
                    className="size-11 rounded-xl"
                  />
                </div>
              </Link>
              <h1 className="text-3xl font-bold tracking-tight">
                {view === "login"
                  ? "Mirë se u ktheve"
                  : view === "register"
                    ? "Krijo llogarinë e kompanisë"
                    : view === "forgot"
                      ? "Rivendos fjalëkalimin"
                      : "Fjalëkalimi i ri"}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {view === "login"
                  ? "Kyçu për të menaxhuar porositë, tracking dhe integrimet me postat."
                  : view === "register"
                    ? "Regjistro kompaninë tuaj — emri, emaili i adminit dhe fjalëkalimi."
                    : view === "forgot"
                      ? "Shkruani emailin e llogarisë suaj dhe do t'ju dërgojmë një kod rivendosjeje."
                      : `Shkruani kodin e dërguar në ${emailTrimmed} dhe fjalëkalimin tuaj të ri.`}
              </p>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08, ease: "easeOut" }}
            className="rounded-2xl border bg-card p-6"
          >
            {view === "login" && (
              <form onSubmit={handleSignIn} className="space-y-4">
                {emailField("login-email")}
                {passwordField("login-password", "current-password")}

                {error && (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                )}

                <div className="flex items-center justify-between pt-1">
                  {checkbox}
                  <button
                    type="button"
                    onClick={() => {
                      setResetCode("");
                      setResetPassword("");
                      setResetConfirm("");
                      setResetError(null);
                      setView("forgot");
                    }}
                    className="cursor-pointer text-sm text-muted-foreground transition-colors hover:text-blue-500"
                  >
                    Keni harruar fjalëkalimin?
                  </button>
                </div>

                {/* Company Link Card — 2-step tenant verification: shown
                    only when hasCompanyTenant is true and we are NOT on a
                    branded ?tenant= page. Direct auth is blocked above. */}
                {!isTenantMode && hasCompanyTenant && resolvedStore && (
                  <AnimatePresence initial={false} mode="popLayout">
                    <TenantLinkSection
                      key="tenant-link"
                      matchedTenant={resolvedStore}
                      email={emailTrimmed}
                      password={password}
                    />
                  </AnimatePresence>
                )}

                {/* While a tenant lookup is in flight we keep the button
                    visually idle (not disabled, so Enter still routes into
                    the hard gate above and shows the verification hint).
                    When a company IS bound, the standard button is replaced
                    entirely by the Company Link Card CTA. */}
                {!hasCompanyTenant && (
                  <Button
                    type="submit"
                    className="h-11 w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-base font-semibold text-white shadow-[0_8px_24px_-8px_rgba(37,99,235,0.6)] hover:from-blue-500 hover:to-blue-600"
                    disabled={isLoading || tenantLookupPending}
                  >
                    {isLoading ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : null}
                    {tenantLookupPending ? "Duke verifikuar kompaninë…" : "Hyr në Llogari"}
                  </Button>
                )}

                <div className="relative py-1 text-center">
                  <span className="relative z-10 bg-card px-3 text-xs text-muted-foreground">
                    ose
                  </span>
                  <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full rounded-xl text-sm font-medium"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                >
                  <svg viewBox="0 0 24 24" className="mr-2 size-4" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81"
                    />
                  </svg>
                  Kyçuni me Google
                </Button>

                <p className="pt-1 text-center text-xs leading-relaxed text-muted-foreground">
                  Çdo llogari është Administrator i Kompanisë (Business
                  Tenant). Hyrja bëhet përmes linkut të dedikuar të kompanisë.
                </p>

                {/* Register link — centered, subtle gray + bold blue action */}
                <p className="pt-1 text-center text-sm text-muted-foreground">
                  Nuk keni llogari?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setRegisterError(null);
                      setView("register");
                    }}
                    className="cursor-pointer font-semibold text-blue-600 transition-colors hover:text-blue-700"
                  >
                    Regjistrohu
                  </button>
                </p>
              </form>
            )}

            {view === "register" && (
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="company-name"
                    className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    Emri i Kompanisë
                  </Label>
                  <div className="relative">
                    <Building2 className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="company-name"
                      type="text"
                      autoComplete="organization"
                      placeholder="FlladituKS"
                      className="h-11 rounded-xl border-border/80 pl-10 focus-visible:border-blue-500 focus-visible:ring-blue-500/30"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      disabled={registerLoading}
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Linku i dedikuar do të jetë: {" "}
                    <span className="font-medium text-foreground/80">
                      /login?tenant={companyName
                        .trim()
                        .toLowerCase()
                        .normalize("NFD")
                        .replace(/[\u0300-\u036f]/g, "")
                        .replace(/[^a-z0-9]+/g, "")
                        .slice(0, 30) || "kompania"}
                    </span>
                  </p>
                </div>

                {emailField("register-email")}
                {passwordField("register-password", "new-password")}

                <div className="space-y-2">
                  <Label
                    htmlFor="register-confirm"
                    className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    Përsërit fjalëkalimin
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="register-confirm"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      className="h-11 rounded-xl border-border/80 pl-10 pr-10 focus-visible:border-blue-500 focus-visible:ring-blue-500/30"
                      value={registerConfirm}
                      onChange={(e) => setRegisterConfirm(e.target.value)}
                      disabled={registerLoading}
                      required
                      minLength={8}
                    />
                  </div>
                </div>

                {registerError && (
                  <p className="text-sm text-destructive" role="alert">
                    {registerError}
                  </p>
                )}

                <Button
                  type="submit"
                  className="h-11 w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-base font-semibold text-white shadow-[0_8px_24px_-8px_rgba(37,99,235,0.6)] hover:from-blue-500 hover:to-blue-600"
                  disabled={registerLoading}
                >
                  {registerLoading ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : null}
                  Krijo Llogarinë e Kompanisë
                </Button>

                <p className="text-center text-xs leading-relaxed text-muted-foreground">
                  Duke u regjistruar ju pranoni të jeni Administrator i
                  Kompanisë (Business Tenant) në OrderSnap AI.
                </p>

                <button
                  type="button"
                  onClick={() => setView("login")}
                  className="w-full cursor-pointer text-center text-sm text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
                >
                  ← Kthehu në hyrje
                </button>
              </form>
            )}

            {view === "forgot" && (
              <form onSubmit={handleRequestReset} className="space-y-4">
                {emailField("reset-email")}
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Do t'ju dërgojmë një kod 6-shifror për rivendosjen e
                  fjalëkalimit.
                </p>

                {resetError && (
                  <p className="text-sm text-destructive" role="alert">
                    {resetError}
                  </p>
                )}

                <Button
                  type="submit"
                  className="h-11 w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-base font-semibold text-white shadow-[0_8px_24px_-8px_rgba(37,99,235,0.6)] hover:from-blue-500 hover:to-blue-600"
                  disabled={resetLoading}
                >
                  {resetLoading ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : null}
                  Dërgo kodin e rivendosjes
                </Button>

                <button
                  type="button"
                  onClick={() => setView("login")}
                  className="w-full cursor-pointer text-center text-sm text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
                >
                  ← Kthehu në hyrje
                </button>
              </form>
            )}

            {view === "reset" && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="reset-code"
                    className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    Kodi i rivendosjes
                  </Label>
                  <Input
                    id="reset-code"
                    value={resetCode}
                    onChange={(e) =>
                      setResetCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="000000"
                    inputMode="numeric"
                    maxLength={6}
                    className="h-11 rounded-xl border-border/80 text-center text-lg font-semibold tracking-[0.4em] focus-visible:border-blue-500 focus-visible:ring-blue-500/30"
                    disabled={resetLoading}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="new-password"
                    className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    Fjalëkalimi i ri
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      className="h-11 rounded-xl border-border/80 pl-10 pr-10 focus-visible:border-blue-500 focus-visible:ring-blue-500/30"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      disabled={resetLoading}
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

                <div className="space-y-2">
                  <Label
                    htmlFor="confirm-password"
                    className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    Përsërit fjalëkalimin
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="confirm-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      className="h-11 rounded-xl border-border/80 pl-10 pr-10 focus-visible:border-blue-500 focus-visible:ring-blue-500/30"
                      value={resetConfirm}
                      onChange={(e) => setResetConfirm(e.target.value)}
                      disabled={resetLoading}
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

                {resetError && (
                  <p className="text-sm text-destructive" role="alert">
                    {resetError}
                  </p>
                )}

                <Button
                  type="submit"
                  className="h-11 w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-base font-semibold text-white shadow-[0_8px_24px_-8px_rgba(37,99,235,0.6)] hover:from-blue-500 hover:to-blue-600"
                  disabled={resetLoading}
                >
                  {resetLoading ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : null}
                  Ruaj fjalëkalimin e ri
                </Button>

                <button
                  type="button"
                  onClick={() => setView("login")}
                  className="w-full cursor-pointer text-center text-sm text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
                >
                  ← Kthehu në hyrje
                </button>
              </form>
            )}

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

/**
 * Automatically revealed "Hyr nga linku i dedikuar i kompanisë suaj" card.
 * Appears only when the typed email resolves to a company in the database —
 * no manual slug entry required. Clicking navigates to the branded
 * /login?tenant={slug} view, carrying the typed email & password as
 * hand-off params so both inputs pre-fill seamlessly on the target view
 * (the branded page scrubs them from the URL immediately after consuming).
 */
function TenantLinkSection({
  matchedTenant,
  email,
  password,
}: {
  matchedTenant: { slug: string; name: string };
  email: string;
  password: string;
}) {
  const navigate = useNavigate();
  const targetUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/login?tenant=${matchedTenant.slug}`
      : `/login?tenant=${matchedTenant.slug}`;

  const handleGo = (e: React.MouseEvent) => {
    // ONLY permitted action: client-side navigation to the branded tenant
    // page. No auth call, no form submit, no page refresh.
    e.preventDefault();
    e.stopPropagation();
    const params = new URLSearchParams({
      tenant: matchedTenant.slug,
      email: email.trim(),
    });
    if (password) params.set("pw", password);
    navigate(`/login?${params.toString()}`);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="rounded-xl border border-blue-500/25 bg-blue-500/5 p-4"
    >
      <p className="text-sm font-medium text-foreground/90">
        Hyni nga linku i dedikuar i kompanisë suaj:
      </p>

      <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-600/10 px-3 py-2.5">
        <Check className="size-4 shrink-0 text-blue-500" />
        <span className="min-w-0 flex-1 truncate text-xs text-foreground/90">
          {matchedTenant.name}:{" "}
          <span className="font-medium text-blue-500">{targetUrl}</span>
        </span>
      </div>

      <Button
        type="button"
        className="mt-2.5 h-10 w-full rounded-lg bg-blue-600 text-sm font-medium text-white hover:bg-blue-500"
        onClick={handleGo}
      >
        Hyr nga linku i kompanisë
        <ArrowRight className="ml-1 size-4" />
      </Button>
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
