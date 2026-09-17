import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import {
  formatEuro,
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
} from "@/lib/order-types";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  ArrowRight,
  BadgeEuro,
  Clock,
  PackageCheck,
  Sparkles,
  Truck,
  Wallet,
} from "lucide-react";
import { Link } from "react-router";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function currentDateLabel(): string {
  return new Date().toLocaleDateString("sq-AL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function Dashboard() {
  const { user } = useAuth();
  const stats = useQuery(api.orders.stats, {});
  const recentOrders = useQuery(api.orders.recent, { limit: 5 });
  const isAdmin = user?.role === "admin";

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        {/* Greeting header with current date */}
        <header>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Përshëndetje{user?.name ? `, ${user.name.split(" ")[0]}` : ""} 👋
          </h1>
          <p className="mt-1 text-sm capitalize text-muted-foreground">
            {currentDateLabel()}
            {isAdmin ? " · Panel Admin" : ""}
          </p>
        </header>

        {/* KPI cards — all money values strictly in Euros € */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="SOT"
            subtitle="Porosi sot"
            value={stats ? String(stats.todayCount) : undefined}
            icon={<Clock className="size-4" />}
          />
          <KpiCard
            title="AKTIVE"
            subtitle="Në rrugë"
            value={
              stats ? String(stats.byStatus.active ?? 0) : undefined
            }
            icon={<Truck className="size-4" />}
          />
          <KpiCard
            title="TOTAL"
            subtitle="Të gjitha porositë"
            value={stats ? String(stats.total) : undefined}
            icon={<PackageCheck className="size-4" />}
          />
          <KpiCard
            title="WALLET"
            subtitle="Balanca në €"
            value={stats ? formatEuro(stats.wallet ?? 0) : undefined}
            icon={<Wallet className="size-4" />}
            accent
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Quick action */}
          <Card className="border-primary/25 bg-primary/[0.04] lg:col-span-1">
            <CardHeader>
              <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="size-5" />
              </div>
              <CardTitle className="text-base">Porosi e re me AI</CardTitle>
              <CardDescription>
                Ngarkoni një screenshot bisede dhe lëreni AI të plotësojë
                porosinë.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link to="/orders/new">
                  Hap AI Parser
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Recent orders table widget */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Porositë e fundit</CardTitle>
                <CardDescription>5 porositë më të fundit</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/orders">
                  Shiko të gjitha
                  <ArrowRight className="ml-1.5 size-3.5" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {recentOrders === undefined ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : recentOrders.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <BadgeEuro className="size-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    Nuk ka porosi ende. Krijoni të parën me AI Parser.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="pb-2 pr-3 font-medium">Nr.</th>
                        <th className="pb-2 pr-3 font-medium">Klienti</th>
                        <th className="hidden pb-2 pr-3 font-medium sm:table-cell">
                          Qyteti
                        </th>
                        <th className="pb-2 pr-3 text-right font-medium">
                          Shuma
                        </th>
                        <th className="pb-2 text-right font-medium">Statusi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {recentOrders.map((o) => (
                        <RecentRow key={o._id} order={o} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function RecentRow({ order }: { order: Doc<"orders"> }) {
  return (
    <tr className="group">
      <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">
        {order.orderNumber}
      </td>
      <td className="py-2.5 pr-3">
        <div className="font-medium">
          {order.first_name} {order.last_name ?? ""}
        </div>
        <div className="text-xs text-muted-foreground">{order.phone}</div>
      </td>
      <td className="hidden py-2.5 pr-3 text-muted-foreground sm:table-cell">
        {order.city}
      </td>
      <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">
        {formatEuro(order.totalAmount ?? 0)}
      </td>
      <td className="py-2.5 text-right">
        <Badge
          className={
            ORDER_STATUS_COLORS[order.status] ??
            "bg-slate-100 text-slate-700 dark:bg-slate-500/15"
          }
        >
          {ORDER_STATUS_LABELS[order.status] ?? order.status}
        </Badge>
      </td>
    </tr>
  );
}

function KpiCard({
  title,
  subtitle,
  value,
  icon,
  accent,
}: {
  title: string;
  subtitle: string;
  value?: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <Card
      className={
        accent
          ? "border-primary/30 bg-primary/[0.05]"
          : "border-border/60"
      }
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {title}
            </span>
            <span className="text-[11px] text-muted-foreground/70">
              {subtitle}
            </span>
          </div>
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary [&_svg]:size-4">
            {icon}
          </div>
        </div>
        {value === undefined ? (
          <Skeleton className="mt-3 h-7 w-20" />
        ) : (
          <div className="mt-2 text-2xl font-bold tabular-nums tracking-tight">
            {value}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
