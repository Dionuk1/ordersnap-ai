import { AppShell } from "@/components/AppShell";
import { RequireAdmin } from "@/components/RequireAdmin";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  ChevronRight,
  CreditCard,
  FileBarChart,
  LifeBuoy,
  PackageSearch,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

type MoreItem = {
  label: string;
  description: string;
  icon: typeof Bot;
  to?: string;
  adminOnly?: boolean;
  soon?: boolean;
};

const MORE_ITEMS: MoreItem[] = [
  {
    label: "Financat",
    description: "Të ardhurat, pagesat dhe bilanci i portofolit (€).",
    icon: CreditCard,
    soon: true,
  },
  {
    label: "Raportet",
    description: "Raporte javore/mujore të performancës së porosive.",
    icon: FileBarChart,
    soon: true,
  },
  {
    label: "Gjurmimi",
    description: "Ndjek statuset e dërgesave me Postën Cheetah.",
    icon: PackageSearch,
    to: "/orders",
  },
  {
    label: "Cilësimet",
    description: "Gemini API, tarifat postare dhe konfigurimi i postës.",
    icon: Settings,
    to: "/settings",
  },
  {
    label: "Paketa Ime",
    description: "Planet, abonimi dhe konsumi i API-së.",
    icon: CreditCard,
    soon: true,
  },
  {
    label: "AI Asistent",
    description: "Ndihmës inteligjent për porosi dhe analiza.",
    icon: Bot,
    soon: true,
  },
  {
    label: "Mbështetja",
    description: "Kontakto ekipin e OrderSnap AI për ndihmë.",
    icon: LifeBuoy,
    soon: true,
  },
];

export default function More() {
  const { user } = useAuth();
  const [openItem, setOpenItem] = useState<MoreItem | null>(null);

  const handleClick = (item: MoreItem) => {
    if (item.to) return; // navigates via Link
    setOpenItem(item);
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Më shumë</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Mjete shtesë, raporte dhe konfigurime të OrderSnap AI.
          </p>
        </header>

        <div className="overflow-hidden rounded-2xl border bg-card">
          {MORE_ITEMS.map((item, idx) => {
            const Icon = item.icon;
            const inner = (
              <button
                type="button"
                onClick={() => handleClick(item)}
                disabled={item.soon}
                className={cn(
                  "flex w-full items-center gap-4 px-5 py-4 text-left transition-colors",
                  item.to
                    ? "hover:bg-muted/50"
                    : "cursor-default opacity-60",
                )}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-medium">
                    {item.label}
                    {item.soon && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Shpejti
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    {item.description}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>
            );

            return (
              <div key={item.label}>
                {item.to ? (
                  <Link to={item.to} className="block">
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
                {idx < MORE_ITEMS.length - 1 && <div className="h-px bg-border" />}
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          {user?.email ?? "OrderSnap AI"} — Mundësuar nga OrderSnap AI
        </p>
      </div>

      {/* Slide-over detail panel for "Shpejti" items */}
      <AnimatePresence>
        {openItem && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/40"
              onClick={() => setOpenItem(null)}
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed right-0 top-0 z-50 flex h-full w-80 max-w-[85vw] flex-col border-l bg-card p-5 shadow-xl"
            >
              <button
                type="button"
                onClick={() => setOpenItem(null)}
                className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Mbyll"
              >
                <X className="size-4" />
              </button>
              <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <openItem.icon className="size-6" />
              </div>
              <h2 className="mt-4 flex items-center gap-2 text-lg font-semibold">
                {openItem.label}
                {openItem.soon && (
                  <Sparkles className="size-4 text-amber-500" />
                )}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {openItem.description}
              </p>
              <div className="mt-6 rounded-xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
                Kjo funksion është në zhvillim e sipër dhe do të jetë e disponueshme
                së shpejti në OrderSnap AI.
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpenItem(null);
                  toast.info("Do t'ju njoftojmë sapo të lansohet!");
                }}
                className="mt-auto h-10 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Njoftomë kur të lansohet
              </button>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </AppShell>
  );
}
