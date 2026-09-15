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
import { Switch } from "@/components/ui/switch";
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
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Sparkles,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function Settings() {
  return (
    <AppShell>
      <RequireAdmin>
        <div className="flex flex-col gap-6">
          <header>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Cilësimet
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Konfiguroni integrimet API dhe menaxhoni stafin. E dukshme vetëm
              për administratorët.
            </p>
          </header>

          <GeminiSection />
          <CourierSection />
          <StaffSection />
        </div>
      </RequireAdmin>
    </AppShell>
  );
}

function GeminiSection() {
  const settings = useQuery(api.appSettings.getPublicSettings, {});
  const setSetting = useMutation(api.appSettings.setSetting);
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!key.trim()) {
      toast.error("Shkruani çelësin API.");
      return;
    }
    setSaving(true);
    try {
      await setSetting({ key: "gemini_api_key", value: key.trim() });
      toast.success("Gemini API Key u ruajt.");
      setKey("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ruajtja dështoi.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setSaving(true);
    try {
      await setSetting({ key: "gemini_api_key", value: "" });
      toast.success("Gemini API Key u hoq.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Heqja dështoi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-border/60">
      <CardHeader>
        <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Sparkles className="size-5" />
        </div>
        <CardTitle className="text-base">Gemini API Key</CardTitle>
        <CardDescription>
          Çelësi ruhet i sigurt në databazë dhe përdoret nga AI Parser
          (gemini-2.5-flash). Pa çelës, sistemi përdor automatikisht motorin
          lokal.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {settings === undefined ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Badge variant={settings.hasGeminiKey ? "default" : "secondary"}>
                {settings.hasGeminiKey
                  ? `Konfiguruar: ${settings.geminiKeyMask}`
                  : "Nuk është konfiguruar"}
              </Badge>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gemini-key">
                {settings.hasGeminiKey ? "Çelës i re" : "Çelësi API"}
              </Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  id="gemini-key"
                  type={show ? "text" : "password"}
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="AIza..."
                  className="pl-9 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving || !key.trim()}>
                {saving ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
                Ruaj çelësin
              </Button>
              {settings.hasGeminiKey && (
                <Button
                  variant="outline"
                  onClick={handleRemove}
                  disabled={saving}
                >
                  Hiq çelësin
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function CourierSection() {
  return (
    <Card className="border-border/60">
      <CardHeader>
        <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Bot className="size-5" />
        </div>
        <CardTitle className="text-base">Integrimi me Korrier Ekspres</CardTitle>
        <CardDescription>
          Lidhni API-n e korrierit tuaj (p.sh. Posta, Novapost, Econt) për të
          dërguar porositë automatikisht. Vendosni URL-në e API dhe çelësin.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="courier-url">API URL</Label>
            <Input
              id="courier-url"
              placeholder="https://api.korrieri.al/v1/shipments"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="courier-key">API Key</Label>
            <Input
              id="courier-key"
              type="password"
              placeholder="••••••••••••"
            />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
          <div>
            <p className="text-sm font-medium">Sinkronizim automatik</p>
            <p className="text-xs text-muted-foreground">
              Dërgo porositë e konfirmuara te korrieri automatikisht.
            </p>
          </div>
          <Switch defaultChecked={false} disabled />
        </div>
        <p className="text-xs text-muted-foreground">
          Integrimi i plotë me korrierin kërkon konfigurim shtesë — të dhënat e
          mësipërme ruhen për përdorim të ardhshëm.
        </p>
      </CardContent>
    </Card>
  );
}

function StaffSection() {
  const staff = useQuery(api.staff.listStaff, {});
  const setRole = useMutation(api.staff.setRole);

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      await setRole({
        userId: userId as never,
        role: role === "admin" ? "admin" : "agent",
      });
      toast.success("Roli u përditësua");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gabim");
    }
  };

  return (
    <Card className="border-border/60">
      <CardHeader>
        <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Users className="size-5" />
        </div>
        <CardTitle className="text-base">Menaxhimi i Stafit</CardTitle>
        <CardDescription>
          Ndryshoni rolet e përdoruesve: Admin ka qasje të plotë, Agent vetëm
          hyrjen e porosive dhe listën.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {staff === undefined ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : staff.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nuk ka përdorues.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Përdoruesi</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Roli</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map((u) => (
                <TableRow key={u._id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold uppercase text-primary">
                        {(u.name ?? u.email ?? "U").slice(0, 2)}
                      </div>
                      <span className="font-medium">{u.name ?? "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {u.email ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={u.role === "admin" ? "admin" : "agent"}
                      onValueChange={(v) => handleRoleChange(u._id, v)}
                    >
                      <SelectTrigger className="w-32" size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="agent">Agent</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
