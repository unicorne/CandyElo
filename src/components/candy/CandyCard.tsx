"use client";

import Image from "next/image";
import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Candy } from "@/lib/supabase/types";

type Props = {
  candy: Pick<
    Candy,
    | "id"
    | "name"
    | "brand"
    | "image_url"
    | "kcal_100g"
    | "sugar_100g"
    | "fat_100g"
    | "ingredients_short"
  >;
  onPick: () => void;
  disabled?: boolean;
  picked?: boolean;
  dimmed?: boolean;
  side: "left" | "right";
};

export function CandyCard({
  candy,
  onPick,
  disabled,
  picked,
  dimmed,
  side,
}: Props) {
  const [open, setOpen] = useState(false);

  const fmt = (n: number | null) =>
    n == null ? "—" : Math.round(n).toString();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: side === "left" ? -24 : 24 }}
      animate={{
        opacity: dimmed ? 0.35 : 1,
        x: 0,
        scale: picked ? 1.04 : dimmed ? 0.96 : 1,
      }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ type: "spring", stiffness: 240, damping: 22 }}
      className="flex-1 min-w-0"
    >
      <Card
        role="button"
        aria-label={`Wähle ${candy.name}`}
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && onPick()}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onPick();
          }
        }}
        className={`
          relative overflow-hidden cursor-pointer select-none
          h-full p-3 sm:p-4 flex flex-col gap-3
          transition-all duration-150
          ${disabled ? "pointer-events-none" : "hover:scale-[1.02] active:scale-[0.98]"}
          ${picked ? "ring-2 ring-primary shadow-2xl shadow-primary/40 bg-primary/5" : ""}
        `}
      >
        {picked && (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-accent/10 pointer-events-none" />
        )}

        <div className="relative w-full aspect-square bg-muted/40 rounded-lg overflow-hidden">
          {candy.image_url ? (
            <Image
              src={candy.image_url}
              alt={candy.name}
              fill
              sizes="(max-width: 640px) 50vw, 320px"
              className="object-contain p-2"
              priority
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-4xl">🍬</div>
          )}
        </div>

        <div className="flex flex-col gap-1 min-w-0 relative">
          <div className="font-semibold text-base sm:text-lg leading-tight line-clamp-2">
            {candy.name}
          </div>
          {candy.brand && (
            <div className="text-xs text-muted-foreground truncate">
              {candy.brand}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          className="
            mt-auto flex items-center justify-between gap-1
            text-xs text-muted-foreground hover:text-foreground
            border-t pt-2 relative
          "
          aria-expanded={open}
        >
          <span>Nährwerte / 100g</span>
          {open ? (
            <ChevronUp className="size-3.5" />
          ) : (
            <ChevronDown className="size-3.5" />
          )}
        </button>

        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            transition={{ duration: 0.18 }}
            className="grid grid-cols-3 gap-1 text-center text-xs relative"
            onClick={(e) => e.stopPropagation()}
          >
            <Stat label="kcal" value={fmt(candy.kcal_100g)} />
            <Stat label="Zucker" value={fmt(candy.sugar_100g)} unit="g" />
            <Stat label="Fett" value={fmt(candy.fat_100g)} unit="g" />
            {candy.ingredients_short && (
              <div className="col-span-3 text-muted-foreground line-clamp-2 mt-1 text-left">
                {candy.ingredients_short}
              </div>
            )}
          </motion.div>
        )}
      </Card>
    </motion.div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-md bg-muted/50 py-1">
      <div className="font-semibold tabular-nums">
        {value}
        {unit && value !== "—" ? <span className="text-muted-foreground">{unit}</span> : null}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

export function CandyCardSkeleton() {
  return (
    <div className="flex-1 min-w-0">
      <Card className="h-full p-3 sm:p-4 flex flex-col gap-3 animate-pulse">
        <div className="w-full aspect-square bg-muted rounded-lg" />
        <div className="h-5 bg-muted rounded w-2/3" />
        <div className="h-3 bg-muted rounded w-1/3" />
      </Card>
    </div>
  );
}

export { Badge };
