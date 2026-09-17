import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  COURIER_FILTER_TABS,
} from "@/lib/order-types";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
  Bot,
  ChevronLeft,
  ChevronRight,
  Copy,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

type Order = Doc<"orders">;

export default function Orders() {
  const [filterTab, setFilterTab] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState("");

  const orders = useQuery(api.orders.list, {
    status: filterTab === "all" ? undefined : filterTab,
    search: search || undefined,
    paginationOpts: { numItems: 15, cursor: page === 0 ? null : String(page) },
  });

  const updateStatus = useMutation(api.orders.updateStatus);
  const removeOrder = useMutation(api.orders.remove);
  const cheetahConfig = useQuery(api.cheetah.getConfig, {});
  const dispatchOrder = useAction(api.cheetah.dispatchOrder);
  const [syncing, setSyncing] = useState(false);

  const handleSyncCourier = async () => {
    if (!orders?.page.length) {
      toast.error("Nuk ka porosi për të sinkronizuari.");
      return;
    }
    if (!cheetahConfig?.hasCredentials) {
      toast.error("Kredencialet e Postës Cheetah nuk janë konfiguruar (Settings → Konfigurimi i Postës).");
      return;
    }
    setSyncing(true);
    // Sync all visible orders that don't have a barcode yet.
    const pending = orders.page.filter((o) => !o.trackingBarcode && !o.courierShipmentId);
    if (pending.length === 0) {
      toast.info("Të gjitha porositë e dukshme janë tashmë të sinkronizuara.");
      setSyncing(false);
      return;
    }
    let ok = 0;
    let failed = 0;
    for (const order of pending) {
      try {
        const result = await dispatchOrder({ orderId: order._id });
        if (result.ok) ok += 1;
        else failed += 1;
      } catch {
        failed += 1;
      }
    }
    setSyncing(false);
    if (ok > 0) toast.success(`${ok} porosi u sinkronizuan me postën.`);
    if (failed > 0) toast.warning(`${failed} dështuan — kontrolloni Audit Trail për detaje.`);
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateStatus({ id: id as never, status: newStatus });
      toast.success("Statusi u përditësua");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gabim");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await removeOrder({ id: id as never });
      toast.success("Porosia u fshi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gabim");
    }
  };

  const copyBarcode = (barcode: string) => {
    navigator.clipboard.writeText(barcode);
    toast.success("Barcode u kopjua!");
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Porositë</h1>
            <p className="mt-1 text-sm text-muted-foreground">Menaxhoni të gjitha porositë në një vend.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSearchInput("")}>
              <Search className="mr-1.5 size-3.5" />
              Gjurmo
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncCourier}
              disabled={syncing}
            >
              {syncing ? (
                <RefreshCw className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 size-3.5" />
              )}
              Sinkronizo me Postën
            </Button>
            <Button asChild size="sm">
              <Link to="/orders/new">
                <Plus className="mr-1.5 size-3.5" />
                Porosi e Re
              </Link>
            </Button>
          </div>
        </header>

        {/* Filter tabs */}
        <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
          {COURIER_FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setFilterTab(tab.key); setPage(0); }}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                filterTab === tab.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <form
          className="relative"
          onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(0); }}
        >
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Kërko emër, telefon, qytet, nr. porosie..."
            className="pl-9"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </form>

        {/* Table */}
        <Card className="border-border/60 py-0 overflow-x-auto">
          <CardContent className="p-0">
            {orders === undefined ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : orders.page.length === 0 ? (
              <div className="flex flex-col items-center gap-3 p-12 text-center">
                <Bot className="size-8 text-muted-foreground/50" />
                <p className="font-medium">Nuk u gjetën porosi</p>
                <p className="text-sm text-muted-foreground">Provoni një kërkim tjetër ose krijoni porosinë e parë.</p>
                <Button asChild variant="outline" size="sm"><Link to="/orders/new">Krijo porosi</Link></Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>ID / Tracking</TableHead>
                    <TableHead>Klienti</TableHead>
                    <TableHead className="hidden md:table-cell">Qyteti</TableHead>
                    <TableHead className="hidden lg:table-cell">Produkti</TableHead>
                    <TableHead className="tabular-nums">Shuma (€)</TableHead>
                    <TableHead>Statusi</TableHead>
                    <TableHead className="text-right">Veprime</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.page.map((o: Order) => (
                    <TableRow key={o._id}>
                      <TableCell>
                        <input type="checkbox" className="size-4 rounded border-slate-300 accent-indigo-600" />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs">{o.orderNumber}</span>
                          {o.trackingBarcode && (
                            <span className="font-mono text-[10px] text-muted-foreground">{o.trackingBarcode}</span>
                          )}
                          <button
                            onClick={() => {
                              // Single-click copy: barcode if dispatched, else order number.
                              const value = o.trackingBarcode ?? o.orderNumber;
                              navigator.clipboard.writeText(value);
                              toast.success(`U kopjua: ${value}`);
                            }}
                            className="text-muted-foreground transition-colors hover:text-foreground"
                            title={o.trackingBarcode ? "Kopjo barcode" : "Kopjo nr. porosise"}
                          >
                            <Copy className="size-3" />
                          </button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{o.first_name} {o.last_name || ""}</div>
                        <div className="text-xs text-muted-foreground">{o.phone}</div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{o.city}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm max-w-32 truncate">{o.productDescription}</TableCell>
                      <TableCell className="tabular-nums font-medium">€{o.totalAmount}</TableCell>
                      <TableCell>
                        <Badge className={ORDER_STATUS_COLORS[o.status] ?? ""}>{ORDER_STATUS_LABELS[o.status] ?? o.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <select
                            value={o.status}
                            onChange={(e) => handleStatusChange(o._id, e.target.value)}
                            className="rounded border border-input bg-transparent px-2 py-1 text-xs"
                          >
                            {ORDER_STATUSES.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>)}
                          </select>
                          <Button variant="ghost" size="icon" className="size-7 text-destructive" title="Fshi" onClick={() => handleDelete(o._id)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {orders && orders.page.length > 0 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{orders.page.length} porosi {orders.isDone ? "" : "(ka më shumë)"}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}><ChevronLeft className="size-4" /></Button>
              <Button variant="outline" size="sm" disabled={orders.isDone} onClick={() => setPage((p) => p + 1)}><ChevronRight className="size-4" /></Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
