import { api } from "@/convex/_generated/api";
import { useSearchParams } from "react-router";
import { AppShell } from "@/components/AppShell";
import { RequireSuperAdmin } from "@/components/RequireSuperAdmin";
import { FadeIn } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  Activity,
  Building2,
  Copy,
  KeyRound,
  Loader2,
  LogIn,
  MailWarning,
  ShieldCheck,
  Store,
  Users,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Tab =
  | "companies"
  | "subscriptions"
  | "audit"
  | "config"
  | "staff";

const TABS: { key: Tab; label: string }[] = [
  { key: "companies", label: "Kompanitë" },
  { key: "subscriptions", label: "Abonimet" },
  { key: "audit", label: "Audit Trail" },
  { key: "config", label: "Konfigurimi Global" },
  { key: "staff", label: "Kredencialet & Stafi" },
];

/** Read the active tab reactively from the URL (?tab=) — re-renders on change. */
function useActiveTab(): [Tab, (t: Tab) => void] {
  const [params, setParams] = useSearchParams();
  const current = (params.get("tab") ?? "companies") as Tab;
  const setTab = (t: Tab) => {
    // replace: false → pushes history so browser back/forward switches tabs
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", t);
        return next;
      },
      { replace: false },
    );
  };
  return [current, setTab];
}

export default function SuperAdmin() {
  const [tab, setTab] = useActiveTab();

  return (
    <AppShell variant="superadmin">
      <RequireSuperAdmin>
        <div className="flex flex-col gap-6">
          <FadeIn>
            <header className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
                  <ShieldCheck className="size-6 text-primary" />
                  Super Admin Portal
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Menaxhimi i kompanive, abonimeve dhe shëndetit të sistemit SaaS.
                </p>
              </div>
              <nav className="flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    className={`rounded-md px-3.5 py-2 text-sm font-medium transition-all ${
                      tab === t.key
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </nav>
            </header>
          </FadeIn>

          {tab === "companies" && <CompaniesTab />}
          {tab === "subscriptions" && <SubscriptionsTab />}
          {tab === "audit" && <AuditTab />}
          {tab === "config" && <ConfigTab />}
          {tab === "staff" && <StaffTab />}
        </div>
      </RequireSuperAdmin>
    </AppShell>
  );
}

// ── Shared UI helpers ───────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Store;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <MotionCard
      className="border-border/60 shadow-soft edge-glow"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <CardContent className="flex items-center gap-3 px-5">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="text-xl font-bold tabular-nums">{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </MotionCard>
  );
}

const TIER_LABELS: Record<string, string> = {
  free_trial: "Free Trial",
  pro: "Pro",
  enterprise: "Enterprise",
};

const TIER_BADGE: Record<string, string> = {
  free_trial: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
  pro: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  enterprise: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
};

import { cn } from "@/lib/utils";
import { HoverScale as MotionCard } from "@/components/motion";

// ── Kompanitë ───────────────────────────────────────────────────────────────

function CompaniesTab() {
  const companies = useQuery(api.superAdmin.listCompanies, {});
  const setStatus = useMutation(api.superAdmin.setCompanyStatus);
  const impersonate = useMutation(api.superAdmin.impersonate);
  const generateTemp = useAction(api.superAdmin.generateTempPassword);
  const applyTemp = useMutation(api.superAdmin.applyTempPassword);
  const logReset = useMutation(api.superAdmin.logResetEmail);

  const [pwModal, setPwModal] = useState<null | {
    userId: string | null;
    email: string | null;
    name: string;
  }>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleGenerate = async () => {
    if (!pwModal?.userId) return;
    setBusy(true);
    try {
      const temp = await generateTemp({});
      await applyTemp({ userId: pwModal.userId as never, tempPassword: temp });
      setTempPassword(temp);
      toast.success("Fjalëkalimi i përkohshëm u gjenerua.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dështoi.");
    } finally {
      setBusy(false);
    }
  };

  const handleResetEmail = async () => {
    if (!pwModal?.userId || !pwModal.email) return;
    setBusy(true);
    try {
      await logReset({ userId: pwModal.userId as never, email: pwModal.email });
      toast.success(`Email-i i rivendosjes u dërgua te ${pwModal.email}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dështoi.");
    } finally {
      setBusy(false);
    }
  };

  const handleImpersonate = async (tenantId: string, name: string) => {
    try {
      await impersonate({ tenantId: tenantId as never });
      toast.success(`Tani shikoni si kompania "${name}".`);
      window.location.href = "/dashboard";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dështoi.");
    }
  };

  const handleStatusToggle = async (
    tenantId: string,
    current: string,
    name: string,
  ) => {
    const next = current === "suspended" ? "active" : "suspended";
    try {
      await setStatus({ tenantId: tenantId as never, status: next });
      toast.success(
        `"${name}" u ${next === "suspended" ? "pezullua" : "aktivizua"}.`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dështoi.");
    }
  };

  return (
    <FadeIn delay={0.05}>
      <Card className="border-border/60 shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="size-4" /> Kompanitë e Regjistruara
          </CardTitle>
          <CardDescription>
            Menaxho statuset, tarifat, kuotat dhe kredencialet e tenant-eve.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {companies === undefined ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : companies.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nuk ka kompani të regjistruara.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Emri i Store</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Email i Adminit</TableHead>
                    <TableHead>Abonimi</TableHead>
                    <TableHead>AI (30 ditë)</TableHead>
                    <TableHead>Statusi</TableHead>
                    <TableHead className="text-right">Veprime</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map((c) => (
                    <tr
                      key={c._id}
                      className="border-b transition-colors hover:bg-muted/40"
                    >
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                          {c.slug}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.ownerEmail ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge className={TIER_BADGE[c.tier ?? "free_trial"] ?? TIER_BADGE.free_trial}>
                          {TIER_LABELS[c.tier ?? "free_trial"]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm tabular-nums text-muted-foreground">
                        {c.aiParsed30d}
                        {c.monthlyAiQuota ? ` / ${c.monthlyAiQuota}` : ""}
                      </TableCell>
                    </tr>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </FadeIn>
  );
}

// ── Abonimet (SaaS Subscriptions) ───────────────────────────────────────────

function SubscriptionsTab() {
  const companies = useQuery(api.superAdmin.listCompanies, {});
  const setTier = useMutation(api.superAdmin.setCompanyTier);
  const setQuota = useMutation(api.superAdmin.setCompanyQuota);
  const [quotaDrafts, setQuotaDrafts] = useState<Record<string, string>>({});

  if (companies === undefined) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  return (
    <FadeIn delay={0.05}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {companies.map((c) => (
          <Card key={c._id} className="border-border/60 shadow-soft edge-glow">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="truncate">{c.name}</span>
                <Badge className={TIER_BADGE[c.tier ?? "free_trial"] ?? TIER_BADGE.free_trial}>
                  {TIER_LABELS[c.tier ?? "free_trial"]}
                </Badge>
              </CardTitle>
              <CardDescription className="truncate">
                {c.ownerEmail ?? c.slug}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {(["free_trial", "pro", "enterprise"] as const).map((tier) => (
                  <Button
                    key={tier}
                    size="sm"
                    variant={c.tier === tier ? "default" : "outline"}
                    onClick={async () => {
                      try {
                        await setTier({ tenantId: c._id as never, tier });
                        toast.success(`"${c.name}" → ${TIER_LABELS[tier]}`);
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Dështoi.");
                      }
                    }}
                  >
                    {TIER_LABELS[tier]}
                  </Button>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`quota-${c._id}`} className="text-xs text-muted-foreground">
                  Kuota mujore e AI ({c.aiParsed30d} të përdorura / 30 ditë)
                </Label>
                <div className="flex gap-2">
                  <Input
                    id={`quota-${c._id}`}
                    type="number"
                    min="0"
                    placeholder={String(c.monthlyAiQuota ?? 100)}
                    value={quotaDrafts[c._id] ?? ""}
                    onChange={(e) =>
                      setQuotaDrafts((d) => ({ ...d, [c._id]: e.target.value }))
                    }
                  />
                  <Button
                    size="sm"
                    onClick={async () => {
                      const raw = (quotaDrafts[c._id] ?? "").trim();
                      const num = Number(raw);
                      if (!raw || !Number.isFinite(num) || num < 0) {
                        toast.error("Shkruani një kuotë të vlefshme.");
                        return;
                      }
                      try {
                        await setQuota({ tenantId: c._id as never, monthlyAiQuota: num });
                        toast.success("Kuota u ruajt.");
                        setQuotaDrafts((d) => ({ ...d, [c._id]: "" }));
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Dështoi.");
                      }
                    }}
                  >
                    Ruaj
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </FadeIn>
  );
}

// ── Audit Trail ─────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  "superadmin.company_status": "Statusi i kompanisë",
  "superadmin.company_tier": "Ndryshim abonimi",
  "superadmin.company_quota": "Ndryshim kuote AI",
  "superadmin.temp_password": "Fjalëkalim i përkohshëm",
  "superadmin.reset_email": "Email rivendosjeje",
  "superadmin.impersonate": "Hyrje si kompani",
  "superadmin.config_updated": "Konfigurim global",
  "superadmin.courier_config": "Kredenciale postë",
};

function AuditTab() {
  const logs = useQuery(api.superAdmin.auditTrail, { limit: 100 });

  return (
    <FadeIn delay={0.05}>
      <Card className="border-border/60 shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="size-4" /> Audit Trail & Logs
          </CardTitle>
          <CardDescription>
            Të gjitha veprimet administrative — rivendosje fjalëkalimesh,
            pezullime dyqanesh, ngjarje impersonimi — me timestamps.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logs === undefined ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nuk ka ngjarje të regjistruara.</p>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={log._id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-muted/20 px-3 py-2.5 transition-colors hover:bg-muted/40"
                >
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {ACTION_LABELS[log.action] ?? log.action}
                  </Badge>
                  <span className="min-w-0 flex-1 text-sm text-foreground/90">
                    {log.details}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {log.actor ?? "Sistemi"} ·{" "}
                    {new Date(log._creationTime).toLocaleString("sq-XK")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </FadeIn>
  );
}

// ── Konfigurimi Global ──────────────────────────────────────────────────────

const CONFIG_FIELDS: { key: string; label: string; placeholder: string; secret?: boolean }[] = [
  { key: "gemini_api_key", label: "Gemini API Key (global fallback)", placeholder: "AIza…", secret: true },
  { key: "shipping_rate_kosovo", label: "Tarifa Kosovë (€)", placeholder: "2.00" },
  { key: "shipping_rate_shqiperi", label: "Tarifa Shqipëri (€)", placeholder: "6.00" },
  { key: "shipping_rate_maqedoni", label: "Tarifa Maqedoni (€)", placeholder: "3.00" },
];

function ConfigTab() {
  const config = useQuery(api.superAdmin.getGlobalConfig, {});
  const setConfig = useMutation(api.superAdmin.setGlobalConfig);
  const courier = useQuery(api.superAdmin.getCourierGlobalConfig, {});
  const setCourier = useMutation(api.superAdmin.setCourierGlobalConfig);

  const [values, setValues] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [courierForm, setCourierForm] = useState({ apiUrl: "", username: "", password: "" });
  const [courierBusy, setCourierBusy] = useState(false);

  const handleSave = async (key: string) => {
    const value = (values[key] ?? "").trim();
    if (!value) {
      toast.error("Shkruani një vlerë.");
      return;
    }
    setBusyKey(key);
    try {
      await setConfig({ key, value });
      toast.success("Konfigurimi u ruajt.");
      setValues((v) => ({ ...v, [key]: "" }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dështoi.");
    } finally {
      setBusyKey(null);
    }
  };

  const handleCourierSave = async () => {
    setCourierBusy(true);
    try {
      await setCourier({
        apiUrl: courierForm.apiUrl.trim() || undefined,
        username: courierForm.username.trim() || undefined,
        password: courierForm.password || undefined,
      });
      toast.success("Kredencialet globale të postës u ruajtën.");
      setCourierForm({ apiUrl: "", username: "", password: "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dështoi.");
    } finally {
      setCourierBusy(false);
    }
  };

  return (
    <FadeIn delay={0.05}>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60 shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4" /> Konfigurimi Global i Sistemit
            </CardTitle>
            <CardDescription>
              Çelësat fallback API dhe tarifat globale të platformës.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {config === undefined ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
            ) : (
              CONFIG_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label htmlFor={field.key}>{field.label}</Label>
                  <div className="flex gap-2">
                    <Input
                      id={field.key}
                      type={field.secret ? "password" : "text"}
                      placeholder={
                        config[field.key]
                          ? `Aktualisht: ${config[field.key]}`
                          : field.placeholder
                      }
                      value={values[field.key] ?? ""}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [field.key]: e.target.value }))
                      }
                    />
                    <Button
                      onClick={() => handleSave(field.key)}
                      disabled={busyKey === field.key}
                    >
                      {busyKey === field.key ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        "Ruaj"
                      )}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="size-4" /> Kredencialet Globale të Postës
            </CardTitle>
            <CardDescription>
              Posta Cheetah — përdoren si fallback kur një kompani nuk ka të
              vetat. Fjalëkalimi ruhet i maskuar dhe nuk shfaqet kurrë.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {courier === undefined ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="courier-url">API URL</Label>
                  <Input
                    id="courier-url"
                    placeholder={courier.apiUrl ?? "https://apigw.posta-ime.com"}
                    value={courierForm.apiUrl}
                    onChange={(e) => setCourierForm((f) => ({ ...f, apiUrl: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="courier-user">Shfrytëzuesi</Label>
                  <Input
                    id="courier-user"
                    placeholder={courier.username ?? "——"}
                    value={courierForm.username}
                    onChange={(e) => setCourierForm((f) => ({ ...f, username: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="courier-pass">Fjalëkalimi</Label>
                  <Input
                    id="courier-pass"
                    type="password"
                    placeholder={courier.hasPassword ? "•••••••• (ruajtur)" : "Vendos fjalëkalimin"}
                    value={courierForm.password}
                    onChange={(e) => setCourierForm((f) => ({ ...f, password: e.target.value }))}
                  />
                </div>
                <Button onClick={handleCourierSave} disabled={courierBusy}>
                  {courierBusy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  Ruaj kredencialet
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </FadeIn>
  );
}

// ── Kredencialet & Stafi ────────────────────────────────────────────────────

function StaffTab() {
  const users = useQuery(api.superAdmin.listAllUsers, {});
  const setStatus = useMutation(api.superAdmin.setCompanyStatus);
  const impersonate = useMutation(api.superAdmin.impersonate);
  const generateTemp = useAction(api.superAdmin.generateTempPassword);
  const applyTemp = useMutation(api.superAdmin.applyTempPassword);
  const logReset = useMutation(api.superAdmin.logResetEmail);

  const [pwModal, setPwModal] = useState<null | {
    userId: string | null;
    email: string | null;
    name: string;
  }>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const openModal = (row: {
    ownerId: string | null;
    ownerEmail: string | null;
    name: string;
  }) => {
    setTempPassword(null);
    setPwModal({ userId: row.ownerId, email: row.ownerEmail, name: row.name });
  };

  const handleGenerate = async () => {
    if (!pwModal?.userId) return;
    setBusy(true);
    try {
      const temp = await generateTemp({});
      await applyTemp({ userId: pwModal.userId as never, tempPassword: temp });
      setTempPassword(temp);
      toast.success("Fjalëkalimi i përkohshëm u gjenerua.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dështoi.");
    } finally {
      setBusy(false);
    }
  };

  const handleResetEmail = async () => {
    if (!pwModal?.userId || !pwModal.email) return;
    setBusy(true);
    try {
      await logReset({ userId: pwModal.userId as never, email: pwModal.email });
      toast.success(`Email-i i rivendosjes u dërgua te ${pwModal.email}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dështoi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <FadeIn delay={0.05}>
      <Card className="border-border/60 shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4" /> Kredencialet & Stafi i Kompanive
          </CardTitle>
          <CardDescription>
            Gjenero fjalëkalime të pëkohshme, dërgo email rivendosjeje, ose
            inspekto një tenant direkt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users === undefined ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nuk ka staf të regjistruar.</p>
          ) : (
            <div className="space-y-2">
              {users.map((u) => (
                <div
                  key={u._id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-muted/20 px-3 py-3 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {u.name ?? u.email ?? "Pa emër"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {u.email ?? "pa email"}
                      {u.tenantName ? ` · ${u.tenantName}` : ""}
                      {u.tenantSlug ? ` (${u.tenantSlug})` : ""}
                    </p>
                  </div>
                  {u.isSuperAdmin ? (
                    <Badge className="bg-gradient-to-r from-blue-600 to-slate-900 text-white">
                      Super Admin
                    </Badge>
                  ) : (
                    <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                      Admin i Kompanisë
                    </Badge>
                  )}
                  {u.tenantStatus === "suspended" && (
                    <Badge
                      variant="outline"
                      className="border-rose-300 text-rose-600 dark:border-rose-500/40 dark:text-rose-300"
                    >
                      Kompani e pezulluar
                    </Badge>
                  )}
                  {!u.isSuperAdmin && (
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          openModal({
                            ownerId: u._id,
                            ownerEmail: u.email,
                            name: u.name ?? u.email ?? "Staf",
                          })
                        }
                        disabled={!u.email}
                      >
                        <KeyRound className="mr-1 size-3.5" />
                        Fjalëkalim
                      </Button>
                      {u.tenantId && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            impersonate({ tenantId: u.tenantId as never })
                              .then(() => {
                                toast.success(`Duke hyrë si "${u.tenantName}"…`);
                                window.location.href = "/dashboard";
                              })
                              .catch((err) =>
                                toast.error(err instanceof Error ? err.message : "Dështoi."),
                              )
                          }
                        >
                          <LogIn className="mr-1 size-3.5" />
                          Hyr si kompani
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>

        <Dialog
          open={pwModal !== null}
          onOpenChange={(open) => !open && setPwModal(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Ndrysho Fjalëkalimin — {pwModal?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Admin i kompanisë:{" "}
                <span className="font-medium text-foreground">{pwModal?.email ?? "—"}</span>
              </p>
              <div className="flex flex-col gap-2">
                <Button onClick={handleGenerate} disabled={busy || !pwModal?.userId}>
                  {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <KeyRound className="mr-2 size-4" />}
                  Auto-Gjenero Fjalëkalim të Përkohshëm
                </Button>
                <Button
                  variant="outline"
                  onClick={handleResetEmail}
                  disabled={busy || !pwModal?.userId || !pwModal?.email}
                >
                  <MailWarning className="mr-2 size-4" />
                  Dërgo Email Rivendosjeje
                </Button>
              </div>
              {tempPassword && (
                <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Fjalëkalimi i përkohshëm
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded bg-muted px-3 py-2 font-mono text-sm">
                      {tempPassword}
                    </code>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(tempPassword);
                        toast.success("U kopjua në clipboard!");
                      }}
                      title="Kopjo"
                    >
                      <Copy className="size-4" />
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Kopjojeni dhe ndajeni me adminin e kompanisë në mënyrë të sigurt.
                    Duhet ta ndryshojë pas hyrjes së parë.
                  </p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </Card>
    </FadeIn>
  );
}
