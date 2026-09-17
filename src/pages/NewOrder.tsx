import { api } from "@/convex/_generated/api";
import {
  COUNTRIES,
  KOSOVO_CITIES,
  ALBANIAN_CITIES,
  MACEDONIAN_CITIES,
  EMPTY_PARSED_ORDER,
  type ParsedOrder,
} from "@/lib/order-types";
import { parseOrderTextLocal } from "@/lib/local-parser";
import { fileToBase64, runOcr } from "@/lib/ocr";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  AlertTriangle, Bot, ImageUp, Keyboard, Loader2, Package, RotateCcw,
  Save, ScanText, Sparkles, User, X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

type Engine = "gemini" | "local" | null;
type CreateMode = "screenshot" | "manual";

export default function NewOrder() {
  const navigate = useNavigate();
  const hasGeminiKey = useQuery(api.appSettings.hasGeminiKey, {});
  const createOrder = useMutation(api.orders.create);
  const parseWithGemini = useAction(api.aiParser.parseWithGemini);

  const [mode, setMode] = useState<CreateMode>("manual");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [engine, setEngine] = useState<Engine>(null);
  const [parsing, setParsing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [parseError, setParseError] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ParsedOrder>({ ...EMPTY_PARSED_ORDER });
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const cities = useMemo(() => {
    switch (form.country) {
      case "Shqipëri": return ALBANIAN_CITIES;
      case "Maqedoni": return MACEDONIAN_CITIES;
      default: return KOSOVO_CITIES;
    }
  }, [form.country]);

  const autoTotal = form.productPrice + (form.postalFee || 0);

  const pickImage = (file: File | null | undefined) => {
    if (!file || !file.type.startsWith("image/")) { toast.error("Skedari duhet të jetë imazh."); return; }
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
    setForm({ ...EMPTY_PARSED_ORDER });
    setEngine(null);
    setParseError(null);
    setOcrText("");
  };

  const handleParse = async () => {
    if (!image) return;
    setParsing(true);
    setParseError(null);
    setOcrProgress(0);
    try {
      let usedEngine: Engine = null;
      if (hasGeminiKey === true) {
        try {
          const base64 = await fileToBase64(image);
          const result = await parseWithGemini({ imageBase64: base64, mimeType: image.type || "image/png" });
          if (result.engine && result.parsed) {
            const p = result.parsed;
            setForm({
              first_name: p.full_name?.split(" ")[0] ?? "",
              last_name: p.full_name?.split(" ").slice(1).join(" ") ?? "",
              phone: p.phone_number ?? "",
              instagram: "",
              city: p.city ?? "",
              address: p.address ?? "",
              addressDetails: "",
              country: "Kosovë",
              productDescription: p.product_notes ?? "",
              productPrice: p.total_amount ?? 0,
              postalFee: 0,
              totalAmount: p.total_amount ?? 0,
              deliveryOpen: false,
              deliveryExchange: false,
            });
            setEngine("gemini");
            usedEngine = "gemini";
          }
        } catch (geminiErr) {
          console.warn("Gemini parse failed, falling back:", geminiErr);
        }
      }
      if (!usedEngine) {
        const text = await runOcr(image, (p) => setOcrProgress(p));
        setOcrText(text);
        const parsed = parseOrderTextLocal(text);
        setForm({
          first_name: parsed.first_name,
          last_name: parsed.last_name,
          phone: parsed.phone,
          instagram: "",
          city: parsed.city,
          address: parsed.address,
          addressDetails: "",
          country: "Kosovë",
          productDescription: parsed.productDescription,
          productPrice: parsed.totalAmount ?? 0,
          postalFee: 0,
          totalAmount: parsed.totalAmount ?? 0,
          deliveryOpen: false,
          deliveryExchange: false,
        });
        setEngine("local");
      }
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Parseimi dështoi.");
    } finally {
      setParsing(false);
    }
  };

  const handleSave = async () => {
    if (!form.first_name || !form.phone) { toast.error("Plotësoni emrin dhe telefonin."); return; }
    setSaving(true);
    try {
      await createOrder({
        first_name: form.first_name,
        last_name: form.last_name || undefined,
        phone: form.phone,
        instagram: form.instagram || undefined,
        country: form.country,
        city: form.city,
        address: form.address,
        addressDetails: form.addressDetails || undefined,
        productDescription: form.productDescription,
        productPrice: form.productPrice,
        postalFee: form.postalFee || undefined,
        totalAmount: autoTotal || form.productPrice,
        deliveryOpen: form.deliveryOpen,
        deliveryExchange: form.deliveryExchange,
        source: engine ?? "manual",
        trackingBarcode: undefined,
      });
      toast.success("Porosia u regjistrua me sukses!");
      navigate("/orders");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Regjistrimi dështoi.");
    } finally {
      setSaving(false);
    }
  };

  const s = (key: keyof ParsedOrder) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const val = e.target.value;
    setForm((f) => {
      const next = { ...f, [key]: val };
      if (key === "productPrice" || key === "postalFee") {
        const pp = key === "productPrice" ? Number(val) || 0 : f.productPrice;
        const pf = key === "postalFee" ? Number(val) || 0 : (f.postalFee || 0);
        next.totalAmount = pp + pf;
      }
      return next;
    });
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-6 pb-24 lg:pb-0">
        <header>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Porosi e Re</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ngarkoni screenshot ose plotësoni formularin manualisht.</p>
        </header>

        {/* Mode switcher */}
        <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
          <button
            onClick={() => setMode("screenshot")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-all ${
              mode === "screenshot" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            <Sparkles className="size-4" />
            Ngarko Screenshot
          </button>
          <button
            onClick={() => setMode("manual")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-all ${
              mode === "manual" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            <Package className="size-4" />
            Shto Manualisht
          </button>
        </div>

        {mode === "screenshot" && (
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base">Ngarko Screenshot</CardTitle>
              <CardDescription>Instagram, WhatsApp, Messenger — AI lexon bisedën dhe plotëson të dhënat.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e.target.files?.[0])} />
              {!imagePreview ? (
                <div
                  role="button" tabIndex={0}
                  onClick={() => inputRef.current?.click()}
                  onKeyDown={(e) => { if (e.key === "Enter") inputRef.current?.click(); }}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); pickImage(e.dataTransfer.files?.[0]); }}
                  className={`flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                    dragOver ? "border-indigo-500 bg-indigo-500/5" : "border-border hover:border-indigo-400 hover:bg-muted/40"
                  }`}
                >
                  <div className="flex size-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15">
                    <ImageUp className="size-6" />
                  </div>
                  <p className="text-sm font-medium">Tërhiqni screenshot këtu</p>
                  <p className="text-xs text-muted-foreground">ose klikoni për të zgjedhur (PNG, JPG)</p>
                </div>
              ) : (
                <div className="relative overflow-hidden rounded-xl border">
                  <img src={imagePreview} alt="Preview" className="max-h-64 w-full object-contain bg-muted/40" />
                  <Button variant="secondary" size="icon" className="absolute right-2 top-2" onClick={() => { setImage(null); setImagePreview(null); setEngine(null); }}>
                    <X className="size-4" />
                  </Button>
                </div>
              )}
              <Button className="w-full" onClick={handleParse} disabled={!image || parsing}>
                {parsing ? <><Loader2 className="mr-2 size-4 animate-spin" />Duke analizuar...</> : <><ScanText className="mr-2 size-4" />Analizo me AI</>}
              </Button>
              {parsing && ocrProgress > 0 && ocrProgress < 100 && (
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-indigo-500 transition-all" style={{ width: `${ocrProgress}%` }} />
                </div>
              )}
              {parseError && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" /><span>{parseError}</span>
                </div>
              )}
              {engine && (
                <Badge variant="secondary" className="gap-1"><Bot className="size-3" />{engine === "gemini" ? "Gemini" : "Lokal"}</Badge>
              )}
            </CardContent>
          </Card>
        )}

        {/* Form */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Client data */}
          <Card className="border-border/60">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><User className="size-4" />Të dhënat e klientit</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Emri*" value={form.first_name} onChange={s("first_name")} placeholder="Arben" />
                <Field label="Mbiemri" value={form.last_name} onChange={s("last_name")} placeholder="Krasniqi" />
              </div>
              <Field label="Telefoni*" value={form.phone} onChange={s("phone")} placeholder="+383 44 123 456" />
              <Field label="Instagram (opsional)" value={form.instagram} onChange={s("instagram")} placeholder="@username" />
            </CardContent>
          </Card>

          {/* Address & postal */}
          <Card className="border-border/60">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Package className="size-4" />Adresa & Posta</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Posta Transportuese</Label>
                <Input value="Posta Cheetah" disabled />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Shteti</Label>
                  <select value={form.country} onChange={s("country") as any} className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm">
                    {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Qyteti*</Label>
                  <input list="city-list" value={form.city} onChange={s("city")} className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm" placeholder="Prishtinë" />
                  <datalist id="city-list">{cities.map((c) => <option key={c} value={c} />)}</datalist>
                </div>
              </div>
              <Field label="Adresa e plotë*" value={form.address} onChange={s("address")} placeholder="Rr. Bill Clinton, Nr. 12" />
              <Field label="Detaje Adrese" value={form.addressDetails} onChange={s("addressDetails")} placeholder="Kati 3, Apartamenti 12" />
            </CardContent>
          </Card>

          {/* Product & pricing */}
          <Card className="border-border/60">
            <CardHeader><CardTitle className="text-base">Produkti & Çmimi</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Field label="Përshkrimi i produktit*" value={form.productDescription} onChange={s("productDescription")} placeholder="Kamizolë e zezë, madhësia M" />
              <div className="grid grid-cols-3 gap-3">
                <Field label="Çmimi (€)*" value={form.productPrice ? String(form.productPrice) : ""} onChange={s("productPrice")} placeholder="25" type="number" />
                <Field label="Tarifa postare (€)" value={form.postalFee ? String(form.postalFee) : ""} onChange={s("postalFee")} placeholder="3" type="number" />
                <div className="space-y-1.5">
                  <Label>Shuma Totale (€)</Label>
                  <div className="flex h-9 items-center rounded-lg border bg-muted/40 px-3 text-sm font-semibold">€{autoTotal.toFixed(2)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Delivery options */}
          <Card className="border-border/60">
            <CardHeader><CardTitle className="text-base">Opsionet e Dorëzimit</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div><p className="text-sm font-medium">Hapëse</p><p className="text-xs text-muted-foreground">Mund të hapet pakoja</p></div>
                <Switch checked={form.deliveryOpen} onCheckedChange={(v) => setForm((f) => ({ ...f, deliveryOpen: v }))} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div><p className="text-sm font-medium">Rinisje</p><p className="text-xs text-muted-foreground">Këmbim produkti</p></div>
                <Switch checked={form.deliveryExchange} onCheckedChange={(v) => setForm((f) => ({ ...f, deliveryExchange: v }))} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-2 pb-20 lg:pb-0">
          <Button className="flex-1" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
            Regjistro porosinë
          </Button>
          <Button variant="outline" onClick={() => setForm({ ...EMPTY_PARSED_ORDER })} disabled={saving}>
            <RotateCcw className="size-4" />
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

function Field({ label, ...props }: React.ComponentProps<typeof Input> & { label: string }) {
  return (<div className="space-y-1.5"><Label>{label}</Label><Input {...props} /></div>);
}
