import { api } from "@/convex/_generated/api";
import { AppShell } from "@/components/AppShell";
import { RequireAdmin } from "@/components/RequireAdmin";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { useAction, useMutation, useQuery } from "convex/react";
import { KeyRound, Loader2, UserPlus, Users, UserX } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type StaffRole = "store_manager" | "order_agent";

const ROLE_LABELS: Record<StaffRole, string> = {
  store_manager: "Menaxher",
  order_agent: "Agjent Porosish",
};

const EMPTY_FORM = {
  name: "",
  email: "",
  password: "",
  role: "order_agent" as StaffRole,
};

export default function Staff() {
  const { user } = useAuth();
  // Debug breadcrumb for blank-screen diagnosis.
  console.log(
    "[Staff Debug] User Role:",
    user?.role ?? "(unknown)",
    "| Store:",
    user?.activeTenantId ?? "(none)",
  );
  const rawStaff = useQuery(api.staff.listStaff, {});
  // Defensive fallback: an undefined/erroring subscription must never crash
  // the component tree — render the empty state instead.
  //
  // Extra safety filter: super-admin platform accounts must never render in
  // a tenant staff table, even if a stale backend response ever carried one
  // (e.g. cached subscription from before the server-side exclusion).
  const staff = (rawStaff ?? []).filter(
    (m) => !(m as { isSuperAdmin?: boolean }).isSuperAdmin,
  );
  const createStaff = useAction(api.staff.createStaffMember);
  const removeAccess = useAction(api.staff.removeStaffAccess);

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await createStaff({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password.trim(),
        role: form.role,
      });
      toast.success(`${form.name.trim()} u shtua në staf.`);
      setForm(EMPTY_FORM);
      setAddOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dështoi shtimi.");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    if (!confirmRemove) return;
    setBusy(true);
    try {
      await removeAccess({ userId: confirmRemove.id as never });
      toast.success(`Qasja e "${confirmRemove.name}" u hoq.`);
      setConfirmRemove(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dështoi heqja.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <RequireAdmin>
        <FadeIn>
          <div className="flex flex-col gap-6">
            <header className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
                  <Users className="size-6 text-primary" />
                  Stafi i Dyqanit
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Menaxho anëtarët e kompanisë tënde dhe qasjen e tyre.
                </p>
              </div>
              <Button onClick={() => setAddOpen(true)}>
                <UserPlus className="mr-2 size-4" />
                Shto Anëtar Stafi
              </Button>
            </header>

            <Card className="border-border/60 shadow-soft">
              <CardHeader>
                <CardTitle className="text-base">Anëtarët e Stafit</CardTitle>
                <CardDescription>
                  Vetëm anëtarët e kompanisë suaj shfaqen këtu — qasja e tyre
                  është e kufizuar te porositë e dyqanit tuaj.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Table headers are ALWAYS rendered — never a silent empty screen. */}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Emri</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Roli</TableHead>
                      <TableHead>Data e Shtimit</TableHead>
                      <TableHead className="text-right">Veprime</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rawStaff === undefined
                      ? Array.from({ length: 3 }).map((_, i) => (
                          <TableRow key={`sk-${i}`}>
                            {Array.from({ length: 5 }).map((_, j) => (
                              <TableCell key={j}>
                                <Skeleton className="h-5 w-full" />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      : staff.length === 0
                        ? (
                          <TableRow>
                            <TableCell colSpan={5} className="h-32 text-center">
                              <div className="flex flex-col items-center gap-2">
                                <Users className="size-8 text-muted-foreground/40" />
                                <p className="text-sm text-muted-foreground">
                                  Nuk ka anëtarë stafi të regjistruar. Kliko
                                  "+ Shto Anëtar Stafi" për të shtuar anëtarin
                                  e parë.
                                </p>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                        : staff.map((m) => (
                        <TableRow key={m._id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold uppercase text-primary">
                                {(m.name ?? m.email ?? "S").slice(0, 2)}
                              </div>
                              <span className="font-medium">{m.name ?? "—"}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {m.email ?? "—"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={cn(
                                m.role === "store_manager"
                                  ? "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
                                  : "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
                              )}
                            >
                              {ROLE_LABELS[m.role]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(m._creationTime).toLocaleDateString("sq-AL")}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled
                                title="Rivendosja e fjalëkalimit vjen së shpejti"
                              >
                                <KeyRound className="mr-1 size-3.5" />
                                Rivendos
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-rose-600 hover:text-rose-700 dark:text-rose-400"
                                onClick={() =>
                                  setConfirmRemove({
                                    id: m._id,
                                    name: m.name ?? m.email ?? "Anëtari",
                                  })
                                }
                              >
                                <UserX className="mr-1 size-3.5" />
                                Hiq Qasje
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </FadeIn>

        {/* Add staff modal */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Shto Anëtar Stafi</DialogTitle>
              <DialogDescription>
                Anëtari do t'i lidhet kompanisë suaj dhe do të shohë vetëm
                porositë e saj.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="staff-name">Emri & Mbiemri</Label>
                <Input
                  id="staff-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Flladi Krasniqi"
                  required
                  minLength={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-email">Email</Label>
                <Input
                  id="staff-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="staf@kompania.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-password">Fjalëkalimi</Label>
                <Input
                  id="staff-password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Minimum 8 karaktere"
                  required
                  minLength={8}
                />
              </div>
              <div className="space-y-2">
                <Label>Roli</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm({ ...form, role: v as StaffRole })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="store_manager">Menaxher</SelectItem>
                    <SelectItem value="order_agent">Agjent Porosish</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <UserPlus className="mr-2 size-4" />
                )}
                Krijo Anëtar
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Remove access confirmation */}
        <Dialog
          open={confirmRemove !== null}
          onOpenChange={(open) => !open && setConfirmRemove(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Hiq Qasjen — {confirmRemove?.name}</DialogTitle>
              <DialogDescription>
                Anëtari do të shkëputet nga kompania dhe do të detyrohet të
                dalë nga llogaria. Llogaria nuk fshihet përfundimisht.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmRemove(null)}>
                Anulo
              </Button>
              <Button
                variant="destructive"
                onClick={handleRemove}
                disabled={busy}
              >
                {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
                Hiq Qasjen
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </RequireAdmin>
    </AppShell>
  );
}
