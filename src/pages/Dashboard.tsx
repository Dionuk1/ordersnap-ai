import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { ORDER_STATUS_LABELS } from "@/lib/order-types";
import {
  ArrowRight,
  Clock,
  DollarSign,
  PackageCheck,
  Sparkles,
  Truck,
} from "lucide-react";
import { Link } from "react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { user } = useAuth();
  const stats = useQuery(api.orders.stats, {});
  const isAdmin = user?.role === "admin";

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Paneli{isAdmin ? " — Admin" : ""}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Përshëndetje{user?.name ? `, ${user.name}` : ""}! Ja një përmbledhje
            e porosive tuaja.
          </p>
        </header>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Porosi gjithsej"
            value={stats?.total}
            icon={<PackageCheck className="size-4" />}
          />
          <StatCard
            title="Sot (24h)"
            value={stats?.todayCount}
            icon={<Clock className="size-4" />}
          />
          <StatCard
            title="Të dorëzuara"
            value={stats?.byStatus?.delivered}
            icon={<Truck className="size-4" />}
          />
          <StatCard
            title="Të ardhura (dorëzuara)"
            value={
              stats ? `${stats.revenue.toLocaleString("sq-AL")} L` : undefined
            }
            icon={<DollarSign className="size-4" />}
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

          {/* Status breakdown */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Sipas statusit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {stats === undefined || stats === null ? (
                <Skeleton className="h-6 w-full" />
              ) : stats.total === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nuk ka porosi ende. Klikoni "Hap AI Parser" për të krijuar të
                  parën.
                </p>
              ) : (
                Object.entries(stats.byStatus).map(([status, count]) => {
                  const pct =
                    stats.total > 0
                      ? Math.round((count / stats.total) * 100)
                      : 0;
                  return (
                    <div key={status} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-xs text-muted-foreground">
                        {ORDER_STATUS_LABELS[status] ?? status}
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary/70"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-xs font-medium tabular-nums">
                        {count}
                      </span>
                    </div>
                  );
                })
              )}
              <div className="pt-2">
                <Button variant="outline" size="sm" asChild>
                  <Link to="/orders">
                    Shiko të gjitha porositë
                    <ArrowRight className="ml-2 size-3.5" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value?: number | string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            {title}
          </span>
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary [&_svg]:size-4">
            {icon}
          </div>
        </div>
        {value === undefined ? (
          <Skeleton className="mt-3 h-7 w-16" />
        ) : (
          <div className="mt-2 text-2xl font-bold tabular-nums tracking-tight">
            {value}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
