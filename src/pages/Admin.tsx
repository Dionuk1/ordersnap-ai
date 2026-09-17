import { api } from "@/convex/_generated/api";
import { AppShell } from "@/components/AppShell";
import { RequireSuperAdmin } from "@/components/RequireSuperAdmin";
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

type Tab = "companies" | "analytics" | "config";

const TABS: { key: Tab; label: string }[] = [
  { key: "companies", label: "Kompanitë" },
  { key: "analytics", label: "Analitikat" },
  { key: "config", label: "Konfigurimi Global" },
];

export default function SuperAdmin() {
  const [tab, setTab] = useState<Tab>("companies");

  return (
    <AppShell>
      <RequireSuperAdmin>
        <div className="flex flex-col gap-6">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
                <ShieldCheck className="size-6 text-primary" />
                Super Admin Portal
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Menaxhimi i kompanive, kredencialeve dhe shëndetit të sistemit SaaS.
              </p>
            </div>
            <nav className="flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1">
              {TABS.map((t) => (
                <button
                  key={t.key}
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

          {tab === "companies" && <CompaniesTab />}
          {tab === "analytics" && <AnalyticsTab />}
          {tab === "config" && <ConfigTab />}
        </div>
      </RequireSuperAdmin>
    </AppShell>
  );
}

// ── Companies ───────────────────────────────────────────────────────────────

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

  const openPasswordModal = (row: {
    ownerId: string | null;
    ownerEmail: string | null;
    name: string;
  }) => {
    setTempPassword(null);
    setPwModal({
      userId: row.ownerId,
      email: row.ownerEmail,
      name: row.name,
    });
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
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="size-4" /> Kompanitë e Regjistruara
        </CardTitle>
        <CardDescription>
          Menaxho statuset, rikthe kredencialet dhe inspekto tenant-et.
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
                  <TableHead>Statusi</TableHead>
                  <TableHead>Krijuar në</TableHead>
                  <TableHead className="text-right">Veprime</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((c) => (
                  <TableRow key={c._id}>
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
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={c.status !== "suspended"}
                          onCheckedChange={() =>
                            handleStatusToggle(c._id, c.status, c.name)
                          }
                        />
                        <Badge
                          className={
                            c.status === "suspended"
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                          }
                        >
                          {c.status === "suspended" ? "Pezulluar" : "Aktiv"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(c.createdAt).toLocaleDateString("sq-XK")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            openPasswordModal({
                              ownerId: c.ownerId,
                              ownerEmail: c.ownerEmail,
                              name: c.name,
                            })
                          }
                          disabled={!c.ownerId}
                          title="Ndrysho Fjalëkalimin"
                        >
                          <KeyRound className="mr-1 size-3.5" />
                          Ndrysho Fjalëkalimin
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleImpersonate(c._id, c.name)}
                          title="Hyr si kjo kompani"
                        >
                          <LogIn className="mr-1 size-3.5" />
                          Hyr si kjo kompani
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Password modal */}
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
  );
}

// ── Analytics ───────────────────────────────────────────────────────────────

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
    <Card className="border-border/60">
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
    </Card>
  );
}

function AnalyticsTab() {
  const stats = useQuery(api.superAdmin.platformStats, {});

  if (stats === undefined) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <KpiCard icon={Store} label="Total Stores" value={stats.totalStores} sub={`${stats.activeStores} aktivë · ${stats.suspendedStores} të pezulluar`} />
      <KpiCard icon={Zap} label="Porosi të AI-Parsuara" value={stats.aiParsedOrders} sub={`${stats.totalOrders} porosi gjithsej`} />
      <KpiCard icon={Users} label="Adminë Aktivë (Mujorë)" value={stats.activeMonthlyAdmins} sub={`${stats.totalUsers} përdorues total`} />
      <KpiCard icon={Building2} label="Ngjarje Auditimi" value={stats.auditEvents} sub="regjistruar platformë-wise" />
    </div>
  );
}

// ── Global Config ───────────────────────────────────────────────────────────

const CONFIG_FIELDS: { key: string; label: string; placeholder: string; secret?: boolean }[] = [
  { key: "gemini_api_key", label: "Gemini API Key (global fallback)", placeholder: "AIza…", secret: true },
  { key: "shipping_rate_kosovo", label: "Tarifa Kosovë (€)", placeholder: "2.00" },
  { key: "shipping_rate_shqiperi", label: "Tarifa Shqipëri (€)", placeholder: "6.00" },
  { key: "shipping_rate_maqedoni", label: "Tarifa Maqedoni (€)", placeholder: "3.00" },
];

function ConfigTab() {
  const config = useQuery(api.superAdmin.getGlobalConfig, {});
  const setConfig = useMutation(api.superAdmin.setGlobalConfig);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);

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

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="size-4" /> Konfigurimi Global i Sistemit
        </CardTitle>
        <CardDescription>
          Çelësat fallback API, tarifat globale dhe parametrat e platformës.
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
  );
}
