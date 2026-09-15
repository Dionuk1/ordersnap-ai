import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
} from "@/lib/order-types";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { useMutation, useQuery } from "convex/react";
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Trash2,
  Truck,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

type Order = Doc<"orders">;

export default function Orders() {
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState("");

  const orders = useQuery(api.orders.list, {
    status: status === "all" ? undefined : status,
    search: search || undefined,
    paginationOpts: { numItems: 15, cursor: page === 0 ? null : String(page) },
  });

  const updateStatus = useMutation(api.orders.updateStatus);
  const removeOrder = useMutation(api.orders.remove);
  const markSynced = useMutation(api.orders.markCourierSynced);

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateStatus({ id: id as never, status: newStatus });
      toast.success("Statusi u përditësua");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gabim gjatë përditësimit");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await removeOrder({ id: id as never });
      toast.success("Porosia u fshi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gabim gjatë fshirjes");
    }
  };

  const handleCourierSync = async (order: Order) => {
    // Courier sync placeholder: without a courier API configured we mark intent
    try {
      await markSynced({
        id: order._id as never,
        shipmentId: undefined,
        error: undefined,
      });
      toast.info(
        "Porosia u shënuua për dërgesë. Konfiguroni API-n e korrierit te Cilësimet për sinkronizim automatik.",
      );
    } catch {
      toast.error("Sinkronizimi dështoi");
    }
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Porositë
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Menaxhoni të gjitha porositë në një vend.
            </p>
          </div>
          <Button asChild>
            <Link to="/orders/new">
              <Plus className="mr-2 size-4" />
              Porosi e Re (AI)
            </Link>
          </Button>
        </header>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <form
            className="relative flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(searchInput);
              setPage(0);
            }}
          >
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Kërko emër, telefon, qytet..."
              className="pl-9"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </form>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Statusi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Të gjitha</SelectItem>
              {ORDER_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {ORDER_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card className="border-border/60 py-0">
          <CardContent className="p-0">
            {orders === undefined ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : orders.page.length === 0 ? (
              <div className="flex flex-col items-center gap-3 p-12 text-center">
                <Bot className="size-8 text-muted-foreground/50" />
                <p className="font-medium">Nuk u gjetën porosi</p>
                <p className="text-sm text-muted-foreground">
                  Provoni një kërkim tjetër ose krijoni porosinë e parë me AI.
                </p>
                <Button asChild variant="outline" size="sm">
                  <Link to="/orders/new">Krijo me AI</Link>
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nr. Porosisë</TableHead>
                    <TableHead>Klienti</TableHead>
                    <TableHead className="hidden md:table-cell">Qyteti</TableHead>
                    <TableHead className="hidden sm:table-cell">
                      Totali
                    </TableHead>
                    <TableHead>Statusi</TableHead>
                    <TableHead className="text-right">Veprime</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.page.map((o: Order) => (
                    <TableRow key={o._id}>
                      <TableCell className="font-mono text-xs">
                        {o.orderNumber}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{o.full_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          {o.phone_number || "—"}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {o.city || "—"}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell tabular-nums">
                        {o.total_amount
                          ? `${o.total_amount.toLocaleString("sq-AL")} L`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            ORDER_STATUS_COLORS[o.status] ??
                            "bg-muted text-muted-foreground"
                          }
                        >
                          {ORDER_STATUS_LABELS[o.status] ?? o.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Select
                            value={o.status}
                            onValueChange={(v) => handleStatusChange(o._id, v)}
                          >
                            <SelectTrigger size="sm" className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ORDER_STATUSES.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {ORDER_STATUS_LABELS[s]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Sinkronizo me korrierin"
                            onClick={() => handleCourierSync(o)}
                          >
                            <Truck className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Fshi"
                            onClick={() => handleDelete(o._id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
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

        {/* Pagination */}
        {orders && orders.page.length > 0 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {orders.page.length} porosi në këtë faqe
              {orders.isDone ? "" : " (ka më shumë)"}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={orders.isDone}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
