import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { Loader2, PackageSearch, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SortKey = "newest" | "price_asc" | "price_desc" | "name_asc";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "Rekomanduara" },
  { key: "price_asc", label: "Çmimi ↑" },
  { key: "price_desc", label: "Çmimi ↓" },
  { key: "name_asc", label: "Emri A–Z" },
];

function StockBadge({ stock }: { stock: number }) {
  if (stock <= 0) {
    return (
      <Badge variant="secondary" className="gap-1 text-[10px] text-muted-foreground">
        Stok u zbumë
      </Badge>
    );
  }
  if (stock <= 10) {
    return (
      <Badge className="gap-1 bg-amber-100 text-[10px] text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
        Vetëm {stock} copë
      </Badge>
    );
  }
  return (
    <Badge className="gap-1 bg-emerald-100 text-[10px] text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
      Në stok
    </Badge>
  );
}

export default function Catalog() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const seedRef = useRef(false);

  const ensureDemoProducts = useMutation(api.products.ensureDemoProducts);
  useEffect(() => {
    if (seedRef.current) return;
    seedRef.current = true;
    ensureDemoProducts().catch(() => {
      /* non-fatal */
    });
  }, [ensureDemoProducts]);

  // Debounce search input to keep the reactive query light.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const products = useQuery(api.products.list, {
    search: debouncedSearch || undefined,
    category: category === "all" ? undefined : category,
    sort,
  });
  const categories = useQuery(api.products.categories, {});

  const placeholderCount = useMemo(() => 8, []);

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Katalogu</h1>
          <p className="text-sm text-muted-foreground">
            Shfletoni produktet, kontrolloni stokun dhe porositni me një klik.
          </p>
        </header>

        {/* Search + sort bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Kërko produkt, kategori, përshkrim…"
              className="h-10 rounded-xl pl-9"
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <SlidersHorizontal className="size-4 shrink-0 text-muted-foreground" />
            {SORTS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSort(s.key)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  sort === s.key
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category chips */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCategory("all")}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
              category === "all"
                ? "border-primary/40 bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            Të gjitha
          </button>
          {categories?.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                category === c
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Grid */}
        {products === undefined ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: placeholderCount }).map((_, i) => (
              <div
                key={i}
                className="h-64 animate-pulse rounded-2xl border bg-muted/40"
              />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed p-16 text-center">
            <PackageSearch className="size-10 text-muted-foreground/50" />
            <p className="font-medium">Nuk u gjetën produkte</p>
            <p className="text-sm text-muted-foreground">
              Provoni një kërkim tjetër ose hiqni filtrat.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch("");
                setCategory("all");
              }}
            >
              Pastro filtrat
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((p, idx) => (
              <ProductCard key={p._id} product={p} index={idx} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function ProductCard({
  product,
  index,
}: {
  product: Doc<"products">;
  index: number;
}) {
  const out = product.stock <= 0;
  const firstSpec = product.specs?.[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.3) }}
      className="group"
    >
      <Link
        to={`/catalog/${product._id}`}
        className={cn(
          "block overflow-hidden rounded-2xl border bg-card shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg",
          out && "opacity-70",
        )}
      >
        {/* Thumb */}
        <div className="relative flex h-32 items-center justify-center bg-gradient-to-br from-indigo-950 via-slate-900 to-black sm:h-40">
          {product.images && product.images[0] ? (
            <img
              src={product.images[0]}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-2xl font-black tracking-tight text-white/90">
              {product.name
                .split(/\s+/)
                .slice(0, 2)
                .map((w) => w[0])
                .join("")
                .toUpperCase()}
            </span>
          )}
          <div className="absolute left-2 top-2">
            <StockBadge stock={product.stock} />
          </div>
        </div>

        <div className="space-y-1.5 p-3.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {product.category}
          </p>
          <h3 className="line-clamp-1 text-sm font-semibold tracking-tight">
            {product.name}
          </h3>
          {firstSpec && (
            <p className="line-clamp-1 text-xs text-muted-foreground">
              {firstSpec.key}: {firstSpec.value}
            </p>
          )}
          <div className="flex items-baseline gap-2 pt-1">
            <span className="text-base font-bold text-primary">
              €{product.price.toFixed(2)}
            </span>
            {product.compareAtPrice && product.compareAtPrice > product.price && (
              <span className="text-xs text-muted-foreground line-through">
                €{product.compareAtPrice.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
