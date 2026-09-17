import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Loader2,
  Package,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function CatalogItem() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const product = useQuery(
    api.products.get,
    id ? { id: id as any } : "skip",
  );
  const ensureDemoProducts = useMutation(api.products.ensureDemoProducts);
  const seededRef = useRef(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    ensureDemoProducts().catch(() => {
      /* non-fatal */
    });
  }, [ensureDemoProducts]);

  if (product === undefined) {
    return (
      <AppShell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (product === null) {
    return (
      <AppShell>
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
          <Package className="size-10 text-muted-foreground/50" />
          <p className="font-medium">Produkti nuk u gjet</p>
          <Button variant="outline" size="sm" asChild>
            <Link to="/catalog">
              <ArrowLeft className="mr-2 size-4" />
              Kthehu në katalog
            </Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return <ProductDetail product={product} galleryIndex={galleryIndex} setGalleryIndex={setGalleryIndex} />;
}

function ProductDetail({
  product,
  galleryIndex,
  setGalleryIndex,
}: {
  product: Doc<"products">;
  galleryIndex: number;
  setGalleryIndex: (i: number) => void;
}) {
  const navigate = useNavigate();
  const out = product.stock <= 0;
  const images = product.images && product.images.length > 0 ? product.images : [];
  const initials = product.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const handleOrderNow = () => {
    if (out) {
      toast.error("Produkti nuk është në stok për momentin.");
      return;
    }
    navigate(`/orders/new?product=${product._id}`);
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <Link
          to="/catalog"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Kthehu në katalog
        </Link>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Gallery */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="space-y-3"
          >
            <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl border bg-gradient-to-br from-indigo-950 via-slate-900 to-black">
              {images[galleryIndex] ? (
                <img
                  src={images[galleryIndex]}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-6xl font-black tracking-tight text-white/90">
                  {initials}
                </span>
              )}
              <div className="absolute left-4 top-4">
                {out ? (
                  <Badge variant="secondary">Stok u zbumë</Badge>
                ) : (
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                    {product.stock} copë në stok
                  </Badge>
                )}
              </div>
            </div>

            {images.length > 1 && (
              <div className="flex gap-2">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setGalleryIndex(i)}
                    className={cn(
                      "size-16 overflow-hidden rounded-lg border-2 transition-colors",
                      galleryIndex === i
                        ? "border-primary"
                        : "border-transparent opacity-70 hover:opacity-100",
                    )}
                  >
                    <img src={img} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          {/* Details */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.08, ease: "easeOut" }}
            className="flex flex-col gap-5"
          >
            <div>
              <Badge variant="outline" className="text-[11px]">
                {product.category}
              </Badge>
              <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                {product.name}
              </h1>
              <div className="mt-3 flex items-baseline gap-3">
                <span className="text-3xl font-bold text-primary">
                  €{product.price.toFixed(2)}
                </span>
                {product.compareAtPrice && product.compareAtPrice > product.price && (
                  <>
                    <span className="text-lg text-muted-foreground line-through">
                      €{product.compareAtPrice.toFixed(2)}
                    </span>
                    <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                      -{Math.round((1 - product.price / product.compareAtPrice) * 100)}%
                    </Badge>
                  </>
                )}
              </div>
            </div>

            {product.description && (
              <p className="text-sm leading-relaxed text-muted-foreground">
                {product.description}
              </p>
            )}

            {/* Availability */}
            <div className="flex items-center gap-2 rounded-xl border bg-muted/40 p-3 text-sm">
              {out ? (
                <>
                  <Package className="size-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    Për momentin jashtë stokut — kontrolloni sërish së shpejti.
                  </span>
                </>
              ) : (
                <>
                  <Check className="size-4 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    I disponueshëm — <strong>{product.stock} copë</strong> të gatshme
                    për dërgesë.
                  </span>
                </>
              )}
            </div>

            {/* Specs */}
            {product.specs && product.specs.length > 0 && (
              <div className="overflow-hidden rounded-xl border">
                <div className="border-b bg-muted/40 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Specifikimet
                </div>
                <dl className="divide-y">
                  {product.specs.map((spec, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm"
                    >
                      <dt className="text-muted-foreground">{spec.key}</dt>
                      <dd className="text-right font-medium">{spec.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {/* Delivery hints */}
            <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-2 rounded-lg border p-3">
                <Truck className="size-4 shrink-0 text-primary" />
                Dërgesa në të gjithë Kosovën
              </div>
              <div className="flex items-center gap-2 rounded-lg border p-3">
                <Package className="size-4 shrink-0 text-primary" />
                pagesa kur merr porosinë
              </div>
            </div>

            {/* CTA */}
            <div className="sticky bottom-20 flex gap-2 lg:bottom-0">
              <Button
                className="h-12 flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 text-base font-semibold text-white shadow-[0_8px_24px_-8px_rgba(79,70,229,0.6)] hover:from-indigo-500 hover:to-indigo-600"
                onClick={handleOrderNow}
                disabled={out}
              >
                <ShoppingCart className="mr-2 size-5" />
                {out ? "Në stok u zbumë" : "Porosit Tani"}
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </AppShell>
  );
}
