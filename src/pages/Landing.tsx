import { motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  ClipboardList,
  KeyRound,
  ScanText,
  ShieldCheck,
  Truck,
  Zap,
} from "lucide-react";
import { Link } from "react-router";
import logo from "@/assets/logo.svg";
import { Footer } from "@/components/Footer";
import { LiquidToggle } from "@/components/ui/LiquidToggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const features = [
  {
    icon: ScanText,
    title: "AI Screenshot Parser",
    description:
      "Ngarkoni screenshot nga Instagram, WhatsApp apo Messenger dhe AI i nxjerr të dhënat e porosisë në sekonda.",
  },
  {
    icon: Bot,
    title: "Dy Motorë Parseimi",
    description:
      "Gemini 2.5 Flash kur keni API key, motori lokal i integruar si rezervë — kurrë mos bllokoni workflow.",
  },
  {
    icon: ClipboardList,
    title: "Menaxhim i Plotë",
    description:
      "Gjurmo porositë nga e re në dorëzuar, filtro sipas statusit dhe kërko klientët në çast.",
  },
  {
    icon: Truck,
    title: "Sinkronizim me Korrier",
    description:
      "Dërgo porositë direkte te shërbimi i korrierit ekspres pa ribashkuar të dhënat me dorë.",
  },
  {
    icon: ShieldCheck,
    title: "Role & Siguri",
    description:
      "Çdo llogari është Administrator i Kompanisë. Çelësat API ruhen të sigurt, të dukshëm vetëm për adminat.",
  },
  {
    icon: Zap,
    title: "E shpejtë si Habi",
    description:
      "Nga screenshot te porosi e regjistruar në më pak se 30 sekonda — pa copy-paste të lodhshëm.",
  },
];

export default function Landing() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-background text-foreground"
    >
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        {/* 3-part grid: brand | centered CTA | actions */}
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          {/* Left: Brand / Logo */}
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="OrderSnap AI" className="size-9 rounded-lg" />
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight">
                OrderSnap AI
              </div>
              <div className="text-[11px] text-muted-foreground">
                Sistemi i Menaxhimit të Porosive
              </div>
            </div>
          </div>

        {/* Right: Theme toggle only */}
          <div className="flex items-center">
            <LiquidToggle speed={87} stretch={36} />
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, hsl(var(--primary) / 0.08) 0%, transparent 70%)",
          }}
        />
        <div className="mx-auto flex max-w-6xl flex-col items-center px-4 pb-20 pt-16 text-center sm:px-6 sm:pt-24">
          <Badge variant="secondary" className="mb-6 gap-1.5 px-3 py-1">
            <SparkleIcon />
            E mundësuar nga Gemini 2.5 Flash
          </Badge>
          <h1 className="max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-6xl">
            Kthe screenshotet e chatit në{" "}
            <span className="text-primary">porosi të gatshme</span>
          </h1>
          <p className="mt-5 max-w-2xl text-pretty text-lg text-muted-foreground">
            Sistemi i Menaxhimit të Porosive dhe Automatizimit me AI. Lexo
            porositë nga Instagram, WhatsApp dhe Messenger automatikisht — pa
            copy-paste, pa gabime.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link to="/login">
                Provoni falas
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="border-primary/20 hover:bg-accent transition-all">
              <Link to="/register">Krijo llogari</Link>
            </Button>
          </div>

          {/* Mock preview card */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="mt-14 w-full max-w-3xl"
          >
            <Card className="border-border/60 shadow-xl shadow-black/5">
              <CardHeader className="flex-row items-center gap-3 space-y-0 border-b bg-muted/40 py-3">
                <div className="flex gap-1.5">
                  <span className="size-3 rounded-full bg-rose-400" />
                  <span className="size-3 rounded-full bg-amber-400" />
                  <span className="size-3 rounded-full bg-emerald-400" />
                </div>
                <span className="text-xs text-muted-foreground">
                  ordersnap.ai / porosi e re
                </span>
              </CardHeader>
              <CardContent className="grid gap-4 p-6 text-left sm:grid-cols-2">
                <div className="space-y-3">
                  <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-center text-xs text-muted-foreground">
                    <ScanText className="mx-auto mb-2 size-5 text-primary" />
                    screenshot_whatsapp.png
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Bot className="size-3.5 text-primary" />
                    AI Parser: gemini-2.5-flash
                  </div>
                </div>
                <div className="space-y-2.5 rounded-lg border bg-card p-4 text-sm">
                  <Field label="Emri" value="Arben Krasniqi" />
                  <Field label="Telefoni" value="+355 69 123 4567" />
                  <Field label="Qyteti" value="Tiranë" />
                  <Field label="Adresa" value="Rr. Myslym Shyri, Nr. 24" />
                  <div className="flex items-center justify-between border-t pt-2.5">
                    <span className="text-xs text-muted-foreground">
                      Totali
                    </span>
                    <span className="font-semibold text-primary">
                      4,500 Lekë
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t bg-muted/30 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              Gjithçka që dyqani juaj online ka nevojë
            </h2>
            <p className="mt-3 text-muted-foreground">
              Nga leximi me AI te dërgesa — një sistem i vetëm, i thjeshtë dhe i
              shpejtë.
            </p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05, duration: 0.4 }}
              >
                <Card className="h-full border-border/60 transition-shadow hover:shadow-lg hover:shadow-black/5">
                  <CardHeader>
                    <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <f.icon className="size-5" />
                    </div>
                    <CardTitle className="text-base">{f.title}</CardTitle>
                    <CardDescription>{f.description}</CardDescription>
                  </CardHeader>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight">
            Gati për të kursyer orë çdo javë?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Regjistrohu në minuta dhe kthe screenshotet e para në porosi sot.
          </p>
          <Button size="lg" className="mt-8" asChild>
            <Link to="/login">
              <KeyRound className="mr-2 size-4" />
              Hap llogarinë tuaj
            </Link>
          </Button>
        </div>
      </section>

      <Footer />
    </motion.div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="truncate text-right font-medium">{value}</span>
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg
      className="size-3.5 text-primary"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z" />
    </svg>
  );
}
