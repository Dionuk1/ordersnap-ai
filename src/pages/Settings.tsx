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
import { COUNTRIES, COUNTRY_FLAGS, COUNTRY_LABELS } from "@/lib/order-types";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  Bot,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  PlugZap,
  Save,
  Sparkles,
  Truck,
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
          <ShippingRatesSection />
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

/** Regional shipping rates per country (EUR), stored in app_settings. */
function ShippingRatesSection() {
  const settings = useQuery(api.appSettings.getPublicSettings, {});
  const setSetting = useMutation(api.appSettings.setSetting);
  const [rates, setRates] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings?.shippingRates) {
      setRates({
        "Kosovë": String(settings.shippingRates["Kosovë"] ?? 2),
        "Shqipëri": String(settings.shippingRates["Shqipëri"] ?? 3),
        "Maqedoni": String(settings.shippingRates["Maqedoni"] ?? 3),
      });
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const country of COUNTRIES) {
        const raw = (rates[country] ?? "").replace(",", ".").trim();
        const num = Number(raw);
        if (!Number.isFinite(num) || num < 0) {
          toast.error(`Tarifa për ${COUNTRY_LABELS[country] ?? country} duhet të jetë numër i vlefshëm.`);
          setSaving(false);
          return;
        }
        await setSetting({ key: `shipping_rate_${country.toLowerCase().replace(/[^a-z0-9]/g, "")}`, value: String(num) });
      }
      toast.success("Tarifat postare u ruajtën.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ruajtja dështoi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-border/60">
      <CardHeader>
        <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Truck className="size-5" />
        </div>
        <CardTitle className="text-base">Tarifat Regionale të Postës (€)</CardTitle>
        <CardDescription>
          Tarifa fillestare për vend. Këto vlera paraplotësojnë automatikisht
          fushën "Tarifa postare" kur zgjidhet vendi në formularin e porosisë.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {settings === undefined ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {COUNTRIES.map((country) => (
                <div key={country} className="space-y-1.5">
                  <Label htmlFor={`rate-${country}`}>
                    <span className="mr-1.5" aria-hidden>
                      {COUNTRY_FLAGS[country]}
                    </span>
                    {COUNTRY_LABELS[country] ?? country}
                  </Label>
                  <div className="relative">
                    <Input
                      id={`rate-${country}`}
                      type="number"
                      min="0"
                      step="0.5"
                      value={rates[country] ?? ""}
                      onChange={(e) => setRates((r) => ({ ...r, [country]: e.target.value }))}
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">€</span>
                  </div>
                </div>
              ))}
            </div>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
              Ruaj tarifat
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Konfigurimi i Postës (Posta Cheetah) — credentials, test, auto-dispatch. */
function CourierSection() {
  const config = useQuery(api.cheetah.getConfig, {});
  const saveConfig = useMutation(api.cheetah.saveConfig);
  const testConnection = useAction(api.cheetah.testConnection);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [autoDispatch, setAutoDispatch] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (config && !loaded) {
      setUsername(config.username ?? "");
      setApiUrl(config.apiUrl ?? "");
      setAutoDispatch(config.autoDispatch);
      setLoaded(true);
    }
  }, [config, loaded]);

  const handleSave = async () => {
    if (!username.trim() || !password) {
      toast.error("Plotësoni Shfrytëzuesin dhe Fjalëkalimin.");
      return;
    }
    setSaving(true);
    try {
      await saveConfig({ username: username.trim(), password, apiUrl: apiUrl.trim() || undefined, autoDispatch });
      toast.success("Lidhja me Postën Cheetah u ruajt.");
      setPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ruajtja dështoi.");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!username.trim() || !password) {
      toast.error("Plotësoni Shfrytëzuesin dhe Fjalëkalimin për testim.");
      return;
    }
    setTesting(true);
    try {
      const result = await testConnection({ username: username.trim(), password, apiUrl: apiUrl.trim() || undefined });
      if (result.ok) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("Testimi i lidhjes dështoi.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="border-border/60">
      <CardHeader>
        <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Bot className="size-5" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">Konfigurimi i Postës (Posta Cheetah)</CardTitle>
          {config !== undefined && (
            <Badge variant={config.hasCredentials ? "default" : "secondary"}>
              {config.hasCredentials ? "Konfiguruar" : "Nuk është konfiguruar"}
            </Badge>
          )}
        </div>
        <CardDescription>
          Lidhni llogarinë e Postës Cheetah për të dërguar porositë automatikisht
          dhe për të marrë kodin e gjurmimit (barcode).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {config === undefined ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cheetah-username">Shfrytëzuesi</Label>
                <Input
                  id="cheetah-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ID e llogarisë / përdoruesi"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cheetah-password">Fjalëkalimi</Label>
                <div className="relative">
                  <Input
                    id="cheetah-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={config.hasCredentials ? "•••••••• (ruajtur)" : "••••••••"}
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cheetah-url">API URL (opsional)</Label>
              <Input
                id="cheetah-url"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://apigw.posta-ime.com"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
              <div>
                <p className="text-sm font-medium">Dërgo automatikisht në postë</p>
                <p className="text-xs text-muted-foreground">
                  Dërgo porosinë te Posta Cheetah menjëherë pas krijimit dhe ruaj kodin e gjurmimit.
                </p>
              </div>
              <Switch checked={autoDispatch} onCheckedChange={setAutoDispatch} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
                Ruaj Lidhjen
              </Button>
              <Button variant="outline" onClick={handleTest} disabled={testing || !username.trim() || !password}>
                {testing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <PlugZap className="mr-2 size-4" />}
                Testo Lidhjen
              </Button>
            </div>
          </>
        )}
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
        <CardTitle className="text-base">Menaxhimi i Kompanive</CardTitle>
        <CardDescription>
          Çdo llogari është Administrator i Kompanisë me qasje të plotë te
          porositë, katalogu dhe konfigurimet e biznesit të vet.
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
                        <SelectItem value="admin">Administrator i Kompanisë</SelectItem>
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
