import { api } from "@/convex/_generated/api";
import type { ParsedOrder } from "@/lib/order-types";
import { EMPTY_PARSED_ORDER, parseOrderTextLocal } from "@/lib/local-parser";
import { fileToBase64, runOcr } from "@/lib/ocr";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  Bot,
  ImageUp,
  Loader2,
  RotateCcw,
  Save,
  ScanText,
  Sparkles,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

type Engine = "gemini" | "local" | null;

export default function NewOrder() {
  const navigate = useNavigate();
  const hasGeminiKey = useQuery(api.appSettings.hasGeminiKey, {});
  const createOrder = useMutation(api.orders.create);
  const parseWithGemini = useAction(api.aiParser.parseWithGemini);
  const parseOrderText = useAction(api.aiParser.parseOrderText);

  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [engine, setEngine] = useState<Engine>(null);
  const [parsing, setParsing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [parseError, setParseError] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ParsedOrder>({ ...EMPTY_PARSED_ORDER });
  const [dragOver, setDragOver] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const pickImage = (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Skedari duhet të jetë imazh.");
      return;
    }
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
      // Step 1: try Gemini if a key is configured
      let usedEngine: Engine = null;
      if (hasGeminiKey === true) {
        try {
          const base64 = await fileToBase64(image);
          const result = await parseWithGemini({
            imageBase64: base64,
            mimeType: image.type || "image/png",
          });
          if (result.engine && result.parsed) {
            setForm(result.parsed);
            setEngine("gemini");
            usedEngine = "gemini";
          }
        } catch (geminiErr) {
          console.warn(
            "Gemini parse failed, falling back to local engine:",
            geminiErr,
          );
        }
      }

      // Step 2: local fallback — OCR + heuristic parse (or server text parse)
      if (!usedEngine) {
        const text = await runOcr(image, (p) => setOcrProgress(p));
        setOcrText(text);
        const parsed = parseOrderTextLocal(text);
        setForm(parsed);
        setEngine("local");
      }
    } catch (err) {
      setParseError(
        err instanceof Error ? err.message : "Parseimi dështoi. Provoni përsëri.",
      );
    } finally {
      setParsing(false);
    }
  };

  const handleSave = async () => {
    if (!form.full_name && !form.phone_number) {
      toast.error("Plotësoni të paktën emrin ose numrin e telefonit.");
      return;
    }
    setSaving(true);
    try {
      await createOrder({
        full_name: form.full_name,
        phone_number: form.phone_number,
        city: form.city,
        address: form.address,
        product_notes: form.product_notes,
        total_amount: Number(form.total_amount) || 0,
        parsedBy: engine ?? "manual",
        rawResponse: ocrText || undefined,
      });
      toast.success("Porosia u regjistrua me sukses!");
      navigate("/orders");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Regjistrimi i porosisë dështoi.",
      );
    } finally {
      setSaving(false);
    }
  };

  const set = (key: keyof ParsedOrder) => (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Porosi e Re — AI Parser
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ngarkoni screenshot e bisedës (Instagram, WhatsApp, Messenger) dhe
            AI e kthen në porosi.
          </p>
        </header>

        {/* Engine status */}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Badge
            variant={hasGeminiKey ? "default" : "secondary"}
            className="gap-1.5"
          >
            <Sparkles className="size-3" />
            Gemini 2.5 Flash: {hasGeminiKey === undefined
              ? "duke kontrolluar..."
              : hasGeminiKey
                ? "aktiv"
                : "pa API key"}
          </Badge>
          <Badge variant="outline" className="gap-1.5">
            <Bot className="size-3" />
            Motori lokal: gjithmonë aktiv
          </Badge>
          {hasGeminiKey === false && (
            <span className="text-xs text-muted-foreground">
              Shtoni "Gemini API Key" te Cilësimet (admin) për parseim më të
              saktë.
            </span>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Upload side */}
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base">1. Ngarko Screenshot</CardTitle>
              <CardDescription>
                Zona e ngarkimit mbështet drag & drop dhe zgjedhje manuale.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => pickImage(e.target.files?.[0])}
              />

              {!imagePreview ? (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => inputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") inputRef.current?.click();
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    pickImage(e.dataTransfer.files?.[0]);
                  }}
                  className={`flex min-h-52 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                    dragOver
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-muted/40"
                  }`}
                >
                  <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <ImageUp className="size-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      Tërhiqni screenshot këtu
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      ose klikoni për të zgjedhur (PNG, JPG)
                    </p>
                  </div>
                </div>
              ) : (
                <div className="relative overflow-hidden rounded-xl border">
                  <img
                    src={imagePreview}
                    alt="Screenshot preview"
                    className="max-h-72 w-full object-contain bg-muted/40"
                  />
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute right-2 top-2"
                    onClick={() => {
                      setImage(null);
                      setImagePreview(null);
                      setForm({ ...EMPTY_PARSED_ORDER });
                      setEngine(null);
                    }}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              )}

              <Button
                className="w-full"
                onClick={handleParse}
                disabled={!image || parsing || hasGeminiKey === undefined}
              >
                {parsing ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Duke analizuar...
                  </>
                ) : (
                  <>
                    <ScanText className="mr-2 size-4" />
                    Analizo me AI
                  </>
                )}
              </Button>

              {parsing && ocrProgress > 0 && ocrProgress < 100 && (
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${ocrProgress}%` }}
                  />
                </div>
              )}

              {parseError && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}

              {ocrText && (
                <details className="rounded-lg border bg-muted/30 p-3 text-xs">
                  <summary className="cursor-pointer text-muted-foreground">
                    Teksti i nxjerrë nga OCR
                  </summary>
                  <pre className="mt-2 whitespace-pre-wrap text-muted-foreground">
                    {ocrText}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>

          {/* Result form */}
          <Card className="border-border/60">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">
                  2. Të dhënat e porosisë
                </CardTitle>
                <CardDescription>
                  Rishikoni dhe korrigjoni përpara regjistrimit.
                </CardDescription>
              </div>
              {engine && (
                <Badge variant="secondary" className="gap-1">
                  <Bot className="size-3" />
                  {engine === "gemini" ? "Gemini" : "Lokal"}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Emri i plotë" value={form.full_name} onChange={set("full_name")} placeholder="Arben Krasniqi" />
              <Field label="Numri i telefonit" value={form.phone_number} onChange={set("phone_number")} placeholder="+355 69 123 4567" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Qyteti" value={form.city} onChange={set("city")} placeholder="Tiranë" />
                <Field
                  label="Totali (Lekë)"
                  value={form.total_amount ? String(form.total_amount) : ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      total_amount: Number(e.target.value.replace(/\D/g, "")) || 0,
                    }))
                  }
                  placeholder="4500"
                  type="text"
                  inputMode="numeric"
                />
              </div>
              <Field label="Adresa" value={form.address} onChange={set("address")} placeholder="Rr. Myslym Shyri, Nr. 24" />
              <div className="space-y-1.5">
                <Label>Shënime produkti</Label>
                <textarea
                  className="flex min-h-20 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:opacity-50"
                  value={form.product_notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, product_notes: e.target.value }))
                  }
                  placeholder="Produkti, madhësia, ngjyra..."
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button className="flex-1" onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 size-4" />
                  )}
                  Regjistro porosinë
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setForm({ ...EMPTY_PARSED_ORDER })}
                  disabled={saving}
                >
                  <RotateCcw className="size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function Field({
  label,
  ...props
}: React.ComponentProps<typeof Input> & { label: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input {...props} />
    </div>
  );
}
