import { api } from "@/convex/_generated/api";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { formatEuroFull } from "@/lib/order-types";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import {
  Download,
  MessageCircle,
  Search,
  ShieldAlert,
  ShoppingCart,
  Users,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";

export default function Clients() {
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [problematicOnly, setProblematicOnly] = useState(false);
  const [minOrders, setMinOrders] = useState("");

  const stats = useQuery(api.crm.clientStats, {});
  const clients = useQuery(api.crm.listClients, {
    search: search || undefined,
    problematicOnly,
    minOrders: Number(minOrders) > 0 ? Number(minOrders) : undefined,
  });

  const handleExport = () => {
    if (!clients || clients.length === 0) return;
    const header = "Emri,Mbiemri,Telefoni,Instagram,Qyteti,Shteti,Porosi,Shpenzime (EUR),Refuzime,Norma Refuzimit (%)\n";
    const rows = clients
      .map((c) =>
        [
          c.first_name,
          c.last_name,
          c.phone,
          c.instagram ?? "",
          c.city,
          c.country,
          c.totalOrders,
          c.totalSpent.toFixed(2),
          c.refusedOrders,
          `${c.refusalRate}%`,
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `klientet-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const summary = useMemo(() => {
    if (!stats) return null;
    return stats;
  }, [stats]);

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Klientët</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              CRM i klientëve — profil, shpenzime dhe norma e refuzimit.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!clients?.length}>
            <Download className="mr-1.5 size-3.5" />
            Eksporto CSV
          </Button>
        </header>

        {/* Overview cards */}
        {summary === null ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border/60">
              <CardContent className="flex items-center gap-3 px-5">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Users className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Të gjithë Klientët</p>
                  <p className="text-xl font-bold tabular-nums">{summary.totalClients}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="flex items-center gap-3 px-5">
                <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                  <ShoppingCart className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Të gjitha Porositë</p>
                  <p className="text-xl font-bold tabular-nums">{summary.totalOrders}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="flex items-center gap-3 px-5">
                <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                  <Wallet className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Shpenzimet (€)</p>
                  <p className="text-xl font-bold tabular-nums">{formatEuroFull(summary.totalSpent)}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="flex items-center gap-3 px-5">
                <div className="flex size-10 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600">
                  <ShieldAlert className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Norma e Refuzimit</p>
                  <p className={cn("text-xl font-bold tabular-nums", summary.refusalRate >= 20 && "text-rose-600")}>
                    {summary.refusalRate}%
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <form
            className="relative flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(searchInput);
            }}
          >
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Kërko sipas emrit, telefonit ose qytetit..."
              className="pl-9"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </form>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                placeholder="Min. porosi"
                className="h-9 w-32"
                value={minOrders}
                onChange={(e) => setMinOrders(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="problematic"
                checked={problematicOnly}
                onCheckedChange={setProblematicOnly}
              />
              <Label htmlFor="problematic" className="text-sm text-muted-foreground">
                Vetëm problematikë
              </Label>
            </div>
          </div>
        </div>

        {/* Client cards */}
        {clients === undefined ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-36" />
            ))}
          </div>
        ) : clients.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-2 p-12 text-center">
              <Users className="size-8 text-muted-foreground/50" />
              <p className="font-medium">Nuk u gjetën klientë</p>
              <p className="text-sm text-muted-foreground">
                Klientët shfaqen automatikisht sapo regjistrohet porosia e parë.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clients.map((c) => {
              const problematic = c.refusalRate >= 50 && c.totalOrders >= 2;
              return (
                <Card
                  key={c._id}
                  className={cn(
                    "border-border/60 transition-shadow hover:shadow-md",
                    problematic && "border-rose-300/60 dark:border-rose-500/30",
                  )}
                >
                  <CardContent className="space-y-3 px-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold uppercase text-primary">
                          {(c.first_name || "K").slice(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {c.first_name} {c.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">{c.phone}</p>
                        </div>
                      </div>
                      <Badge
                        className={cn(
                          "shrink-0 font-semibold",
                          problematic
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                            : c.refusalRate > 0
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
                        )}
                      >
                        {c.refusalRate}% refuzime
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-muted/40 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Porosi</p>
                        <p className="text-sm font-bold tabular-nums">{c.totalOrders}</p>
                      </div>
                      <div className="rounded-lg bg-muted/40 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Shpenzime</p>
                        <p className="text-sm font-bold tabular-nums">{formatEuroFull(c.totalSpent)}</p>
                      </div>
                      <div className="rounded-lg bg-muted/40 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Dorëzuar</p>
                        <p className="text-sm font-bold tabular-nums">{c.deliveredOrders}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {c.city}, {c.country}
                        {c.instagram ? ` · @${c.instagram}` : ""}
                      </span>
                      <a
                        href={`https://wa.me/${c.phone.replace(/\D/g, "").replace(/^0/, "383")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-emerald-600 hover:underline dark:text-emerald-400"
                      >
                        <MessageCircle className="size-3.5" />
                        WhatsApp
                      </a>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
