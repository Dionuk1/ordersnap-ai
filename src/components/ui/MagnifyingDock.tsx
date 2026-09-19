import { cn } from "@/lib/utils";
import { Link, useLocation } from "react-router";
import {
  LayoutDashboard,
  PlusCircle,
  ShoppingBag,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import React, { useRef, useState } from "react";
import "./MagnifyingDock.css";

export interface DockItem {
  id: string;
  label: string;
  icon: React.ElementType;
  href: string;
}

/** Tenant navigation — mirrors AppShell's NAV + ADMINISTRATION_NAV. */
export const DOCK_NAV_ITEMS: DockItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { id: "new-order", label: "Porosi e Re", icon: PlusCircle, href: "/orders/new" },
  { id: "orders", label: "Porositë", icon: ShoppingBag, href: "/orders" },
  { id: "settings", label: "Cilësimet e Dyqanit", icon: SlidersHorizontal, href: "/settings" },
  { id: "staff", label: "Stafi", icon: Users, href: "/staff" },
];

interface MagnifyingDockProps {
  /** Icons scale up to this factor under the pointer (1 = no magnify). */
  magnify?: number;
  /** px the magnified icon lifts off the dock surface. */
  lift?: number;
  /** How many neighbors participate in the falloff (higher = wider wave). */
  spread?: number;
  items?: DockItem[];
  className?: string;
}

/**
 * Bencho-style magnifying dock: the icon under the pointer grows and lifts,
 * neighbors swell with a smooth falloff — like the macOS Dock. Works with
 * both mouse (pointer tracking) and touch (tap = navigate, per-item hover
 * emulation on pointermove).
 */
export function MagnifyingDock({
  magnify = 1.32,
  lift = 8,
  spread = 2,
  items = DOCK_NAV_ITEMS,
  className,
}: MagnifyingDockProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dockRef.current) return;
    const rect = dockRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const itemWidth = rect.width / items.length;
    const index = Math.floor(mouseX / itemWidth);
    setHoveredIndex(Math.max(0, Math.min(items.length - 1, index)));
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  // Touch: per-item pointerenter gives immediate magnify feedback before tap.
  const handleItemPointerEnter = (index: number) => {
    setHoveredIndex(index);
  };

  return (
    <div
      ref={dockRef}
      className={cn("gdock-container", className)}
      style={
        {
          "--magnify": magnify,
          "--lift": lift,
          "--spread": spread,
        } as React.CSSProperties
      }
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onPointerLeave={handleMouseLeave}
    >
      {items.map((item, index) => {
        const Icon = item.icon;
        let distance = 999;
        if (hoveredIndex !== null) {
          distance = Math.abs(hoveredIndex - index);
        }
        const active =
          item.href === "/orders/new"
            ? location.pathname === "/orders/new"
            : location.pathname.startsWith(item.href);

        return (
          <Link
            key={item.id}
            to={item.href}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            data-active={active}
            data-hovered={hoveredIndex === index}
            className="gdock-item"
            style={{ "--d": distance } as React.CSSProperties}
            onPointerEnter={() => handleItemPointerEnter(index)}
          >
            <span className="gdock-glyph">
              <Icon />
            </span>
            <span className="gdock-label">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
