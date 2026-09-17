import { api } from "@/convex/_generated/api";
import { AppShell } from "@/components/AppShell";
import { RequireAdmin } from "@/components/RequireAdmin";
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
  DialogTrigger,
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
import { formatEuroFull } from "@/lib/order-types";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  Archive,
  ArchiveRestore,
  Boxes,
  ChevronDown,
  ChevronUp,
  FileClock,
  Loader2,
  Pencil,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Trash2,
  Truck,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Tab = "overview" | "products" | "users" | "audit";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Përmbledhja" },
  { key: "products", label: "Produktet" },
  { key: "users", label: "Përdoruesit" },
  { key: "audit", label: "Audit Trail" },
];

export default function Admin() {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <AppShell>
      <RequireAdmin>
        <div className="flex flex-col gap-6">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
                <ShieldCheck className="size-6 text-primary" />
                Admin Control Panel
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Qarkullim i plotë i sistemit — vetëm për administratorët.
              </p>
            </div>
            <nav className="flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "rounded-md px-3.5 py-2 text-sm font-medium transition-all",
                    tab === t.key
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </header>

          {tab === "overview" && <OverviewTab />}
          {tab === "products" && <ProductsTab />}
          {tab === "users" && <UsersTab />}
          {tab === "audit" && <AuditTab />}
        </div>
      </RequireAdmin>
    </AppShell>
  );
}

// ── Overview ───────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="px-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-1.5 text-2xl font-bold tracking-tight">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function OverviewTab() {
  const data = useQuery(api.admin.overview, {});
  const cheetah = useQuery(api.cheetah.getConfig, {});

  if (data === undefined) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Përdorues të regjistruar"
          value={String(data.totalUsers)}
          sub={`${data.totalTenants} kompani (tenant)`}
        />
        <StatCard
          label="Të ardhura (dorëzuar)"
          value={formatEuroFull(data.revenue)}
          sub={`${formatEuroFull(data.pipeline)} në rrugë`}
        />
        <StatCard
          label="Porosi totale"
          value={String(data.totalOrders)}
          sub={`${data.ordersToday} në 24 orët e fundit`}
        />
        <StatCard
          label="Produkte në katalog"
          value={String(data.totalProducts)}
          sub={`${data.activeProducts} aktive`}
        />
      </div>

      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Truck className="size-4" /> Statusi i Postës (Cheetah)
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Konfigurimi</p>
            <Badge variant={data.courier.configured ? "default" : "secondary"}>
              {data.courier.configured ? "Konfiguruar" : "Nuk është konfiguruar"}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Dërgesa automatike</p>
            <p className="font-semibold">
              {cheetah?.autoDispatch ? "Aktive" : "Çaktivizuar"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Dërgesa të suksesshme</p>
            <p className="font-semibold">{data.courier.dispatched}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Gabime dërgimi</p>
            <p className="font-semibold">{data.courier.dispatchErrors}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Products CRUD ──────────────────────────────────────────────────────────

function ProductsTab() {
  const products = useQuery(api.admin.listAllProducts, {});
  const createProduct = useMutation(api.admin.createProduct);
  const updateProduct = useMutation(api.admin.updateProduct);
  const setStock = useMutation(api.admin.setStock);
  const archiveProduct = useMutation(api.admin.archiveProduct);
  const removeProduct = useMutation(api.admin.removeProduct);

  const [editing, setEditing] = useState<null | {
    id?: string;
    name: string;
    category: string;
    price: string;
    stock: string;
    description: string;
  }>(null);
  const [busy, setBusy] = useState(false);

  const openNew = () =>
    setEditing({ name: "", category: "Veshje", price: "", stock: "10", description: "" });

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.name.trim() || !editing.category.trim()) {
      toast.error("Emri dhe kategoria janë të detyrueshme.");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: editing.name.trim(),
        category: editing.category.trim(),
        price: Number(editing.price.replace(",", ".")) || 0,
        stock: Number(editing.stock) || 0,
        description: editing.description.trim() || undefined,
      };
      if (editing.id) {
        await updateProduct({ id: editing.id as never, ...payload });
        toast.success("Produkti u përditësua.");
      } else {
        await createProduct({ ...payload, slug: "" });
        toast.success("Produkti u shtua në katalog.");
      }
      setEditing(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ruajtja dështoi.");
    } finally {
      setBusy(false);
    }
  };

  const handleStockDelta = async (id: string, current: number, delta: number) => {
    try {
      await setStock({ id: id as never, stock: Math.max(0, current + delta) });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dështoi.");
    }
  };

  const handleArchive = async (id: string, isActive: boolean) => {
    try {
      await archiveProduct({ id: id as never, archive: isActive });
      toast.success(isActive ? "Produkti u arkivua." : "Produkti u rikthye.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dështoi.");
    }
  };

  const handleRemove = async (id: string, name: string) => {
    if (!window.confirm(`Të fshihet përgjithmonë "${name}"?`)) return;
    try {
      await removeProduct({ id: id as never });
      toast.success("Produkti u fshij.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dështoi.");
    }
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Boxes className="size-4" /> Menaxhimi i Katalogut
          </CardTitle>
          <CardDescription>Shto, edito, ndrysho stokun ose arkivo produkte.</CardDescription>
        </div>
        <Button onClick={openNew} size="sm">
          <Plus className="mr-1.5 size-4" /> Produkt i re
        </Button>
      </CardHeader>
      <CardContent>
        {products === undefined ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <p className="text-sm text-muted-foreground">Katalogu është bosh.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produkti</TableHead>
                  <TableHead>Kategoria</TableHead>
                  <TableHead>Çmimi</TableHead>
                  <TableHead>Stoku</TableHead>
                  <TableHead>Statusi</TableHead>
                  <TableHead className="text-right">Veprime</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p._id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.category}</TableCell>
                    <TableCell className="text-sm">{formatEuroFull(p.price)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost" size="icon" className="size-7"
                          onClick={() => handleStockDelta(p._id, p.stock, -1)}
                        >
                          <ChevronDown className="size-4" />
                        </Button>
                        <span className="min-w-8 text-center text-sm font-semibold tabular-nums">
                          {p.stock}
                        </span>
                        <Button
                          variant="ghost" size="icon" className="size-7"
                          onClick={() => handleStockDelta(p._id, p.stock, +1)}
                        >
                          <ChevronUp className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={p.isActive !== false}
                          onCheckedChange={() => handleArchive(p._id, p.isActive !== false)}
                        />
                        <span className="text-xs text-muted-foreground">
                          {p.isActive !== false ? "Aktiv" : "Arkivuar"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost" size="icon" className="size-8"
                          onClick={() =>
                            setEditing({
                              id: p._id,
                              name: p.name,
                              category: p.category,
                              price: String(p.price),
                              stock: String(p.stock),
                              description: p.description ?? "",
                            })
                          }
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="size-8 text-muted-foreground"
                          onClick={() => handleArchive(p._id, p.isActive !== false)}
                          title={p.isActive !== false ? "Arkivo" : "Rikthe"}
                        >
                          {p.isActive !== false
                            ? <Archive className="size-4" />
                            : <ArchiveRestore className="size-4" />}
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="size-8 text-destructive"
                          onClick={() => handleRemove(p._id, p.name)}
                        >
                          <Trash2 className="size-4" />
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

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edito produktin" : "Produkt i re"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Emri</Label>
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="Patika Nike Air"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Kategoria</Label>
                  <Input
                    value={editing.category}
                    onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                    placeholder="Këpucë"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Çmimi (€)</Label>
                  <Input
                    type="number" min="0" step="0.5"
                    value={editing.price}
                    onChange={(e) => setEditing({ ...editing, price: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Stoku</Label>
                  <Input
                    type="number" min="0"
                    value={editing.stock}
                    onChange={(e) => setEditing({ ...editing, stock: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Përshkrimi</Label>
                <Input
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  placeholder="Përshkrim i shkurtër"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditing(null)}>
                  Anulo
                </Button>
                <Button onClick={handleSave} disabled={busy}>
                  {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Ruaj
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ── User Directory ─────────────────────────────────────────────────────────

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "user", label: "Agent" },
  { value: "member", label: "Customer" },
] as const;

const ROLE_BADGE: Record<string, string> = {
  admin: "bg-slate-100 text-blue-700 font-semibold dark:bg-slate-800 dark:text-blue-400",
  user: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  member: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

function UsersTab() {
  const users = useQuery(api.admin.listUsers, {});
  const setUserRole = useMutation(api.admin.setUserRole);

  const handleChange = async (userId: string, role: string) => {
    try {
      await setUserRole({ userId: userId as never, role: role as "admin" | "user" | "member" });
      toast.success("Roli u përditësua.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dështoi.");
    }
  };

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="size-4" /> Direktoria e Përdoruesve
        </CardTitle>
        <CardDescription>
          Promovo/ul rolet: Customer ↔ Agent ↔ Admin. Roli i adminit nuk mund të hiqet nga veti.
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
          <p className="text-sm text-muted-foreground">Nuk ka përdorues të regjistruar.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Përdoruesi</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Kompania</TableHead>
                  <TableHead>Roli</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u._id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold uppercase text-primary">
                          {(u.name ?? u.email ?? "U").slice(0, 2)}
                        </div>
                        <span className="font-medium">{u.name ?? "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.email ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.companyName ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs",
                            ROLE_BADGE[u.role] ?? ROLE_BADGE.member,
                          )}
                        >
                          {ROLE_OPTIONS.find((r) => r.value === u.role)?.label ?? u.role}
                        </span>
                        <select
                          value={u.role}
                          onChange={(e) => handleChange(u._id, e.target.value)}
                          className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs"
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                        <RefreshCcw className="hidden size-3 text-muted-foreground" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Audit Trail ────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, { label: string; className: string }> = {
  "order.created": { label: "Porosi e re", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  "cheetah.config_saved": { label: "Cheetah config", className: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
  "user.role_changed": { label: "Rol ndryshuar", className: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
};

function AuditTab() {
  const logs = useQuery(api.admin.auditTrail, { limit: 60 });

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileClock className="size-4" /> Audit Trail (Real-time)
        </CardTitle>
        <CardDescription>
          Monitorim i drejtpërdrejtë i krijimit të porosive, dërgesave te posta dhe ndryshimeve të konfigurimit.
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
          <p className="text-sm text-muted-foreground">Nuk ka aktivitet të regjistruar.</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => {
              const meta = ACTION_LABELS[log.action];
              return (
                <div
                  key={log._id}
                  className="flex items-start gap-3 rounded-lg border bg-muted/20 px-3 py-2.5"
                >
                  <span
                    className={cn(
                      "mt-0.5 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                      meta?.className ?? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
                    )}
                  >
                    {meta?.label ?? log.action}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{log.details}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {log.user ?? "Sistemi"} ·{" "}
                      {new Date(log._creationTime).toLocaleString("sq-XK", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
