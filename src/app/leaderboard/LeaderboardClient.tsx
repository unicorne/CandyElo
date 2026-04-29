"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Crown,
  Heart,
  ThumbsDown,
  Vote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { Candy } from "@/lib/supabase/types";

type Row = Pick<
  Candy,
  "id" | "name" | "brand" | "image_url" | "elo" | "matches" | "wins"
>;

export default function LeaderboardClient() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sb = supabaseBrowser();
    let canceled = false;

    (async () => {
      const { data, error } = await sb
        .from("candies")
        .select("id, name, brand, image_url, elo, matches, wins")
        .order("elo", { ascending: false })
        .order("matches", { ascending: false });
      if (canceled) return;
      if (error) setError(error.message);
      else setRows(data as Row[]);
    })();

    const channel = sb
      .channel("candies-leaderboard")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "candies" },
        (payload) => {
          const updated = payload.new as Row;
          setRows((prev) => {
            if (!prev) return prev;
            const next = prev.map((r) =>
              r.id === updated.id ? { ...r, ...updated } : r,
            );
            next.sort(
              (a, b) =>
                Number(b.elo) - Number(a.elo) || b.matches - a.matches,
            );
            return next;
          });
        },
      )
      .subscribe();

    return () => {
      canceled = true;
      sb.removeChannel(channel);
    };
  }, []);

  const { top3, rest, eloMin, eloMax, bonus } = useMemo(() => {
    if (!rows) {
      return {
        top3: [],
        rest: [],
        eloMin: 1500,
        eloMax: 1500,
        bonus: null as null | { mostUnderrated?: Row; mostHated?: Row },
      };
    }
    const visible = rows.filter((r) => r.image_url);
    const top3 = visible.slice(0, 3);
    const rest = visible.slice(3);

    const elos = visible.map((r) => Number(r.elo));
    const eloMin = elos.length ? Math.min(...elos) : 1500;
    const eloMax = elos.length ? Math.max(...elos) : 1500;

    const played = visible.filter((r) => r.matches >= 3);
    let bonus: { mostUnderrated?: Row; mostHated?: Row } | null = null;
    if (played.length >= 3) {
      const byElo = [...played].sort(
        (a, b) => Number(b.elo) - Number(a.elo),
      );
      const lowest = byElo[byElo.length - 1];
      const winRate = (r: Row) => (r.matches > 0 ? r.wins / r.matches : 0);
      const eloThresh = byElo[Math.floor(byElo.length * 0.4)]?.elo ?? 1500;
      const underrated = [...played]
        .filter((r) => Number(r.elo) <= Number(eloThresh))
        .sort((a, b) => winRate(b) - winRate(a))[0];
      bonus = { mostUnderrated: underrated, mostHated: lowest };
    }
    return { top3, rest, eloMin, eloMax, bonus };
  }, [rows]);

  return (
    <div className="flex flex-1 flex-col">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(900px 500px at 50% -10%, color-mix(in oklab, var(--accent) 25%, transparent) 0%, transparent 60%)",
        }}
      />

      <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b bg-background/70 backdrop-blur sticky top-0 z-20">
        <Button asChild variant="ghost" size="sm">
          <Link href="/" aria-label="Zurück">
            <ArrowLeft className="size-4" />
            <span className="sr-only sm:not-sr-only sm:ml-1">Start</span>
          </Link>
        </Button>
        <h1 className="text-base font-bold flex items-center gap-1.5">
          <Crown className="size-4 text-amber-500" />
          Live-Ranking
        </h1>
        <Button asChild variant="ghost" size="sm">
          <Link href="/vote">
            <Vote className="size-4" />
            <span className="sr-only sm:not-sr-only sm:ml-1">Voten</span>
          </Link>
        </Button>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-6">
        {error && <p className="text-destructive text-sm">{error}</p>}

        {/* Podium */}
        {rows === null ? (
          <Skeleton className="h-44 w-full rounded-2xl" />
        ) : top3.length === 3 ? (
          <Podium top3={top3} />
        ) : null}

        {/* Bonus cards */}
        {bonus && (bonus.mostUnderrated || bonus.mostHated) && (
          <section className="grid grid-cols-2 gap-3">
            {bonus.mostUnderrated && (
              <BonusCard
                icon={<Heart className="size-4 text-pink-500" />}
                label="Underrated"
                candy={bonus.mostUnderrated}
                note="hohe Win-Rate, niedriges ELO"
              />
            )}
            {bonus.mostHated && (
              <BonusCard
                icon={<ThumbsDown className="size-4 text-zinc-500" />}
                label="Most Hated"
                candy={bonus.mostHated}
                note="niedrigstes ELO"
              />
            )}
          </section>
        )}

        {/* Rest of the list */}
        <section className="space-y-1.5">
          {rows === null
            ? Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))
            : rest.map((r, i) => (
                <RankRow
                  key={r.id}
                  row={r}
                  rank={i + 4}
                  eloMin={eloMin}
                  eloMax={eloMax}
                />
              ))}
        </section>
      </main>
    </div>
  );
}

function Podium({ top3 }: { top3: Row[] }) {
  // Visual order: 2 - 1 - 3 (silver, gold, bronze) — gold raised in the middle
  const [first, second, third] = top3;
  return (
    <section className="grid grid-cols-3 gap-2 items-end pt-2">
      <PodiumCard row={second} place={2} />
      <PodiumCard row={first} place={1} />
      <PodiumCard row={third} place={3} />
    </section>
  );
}

const PLACE_STYLES: Record<
  1 | 2 | 3,
  { bg: string; ring: string; height: string; emoji: string; chip: string }
> = {
  1: {
    bg: "bg-gradient-to-br from-amber-200 via-amber-100 to-yellow-50",
    ring: "ring-amber-400",
    height: "min-h-[210px]",
    emoji: "🥇",
    chip: "bg-amber-400 text-amber-950",
  },
  2: {
    bg: "bg-gradient-to-br from-zinc-200 via-zinc-100 to-zinc-50",
    ring: "ring-zinc-400",
    height: "min-h-[180px]",
    emoji: "🥈",
    chip: "bg-zinc-400 text-zinc-50",
  },
  3: {
    bg: "bg-gradient-to-br from-orange-200 via-orange-100 to-amber-50",
    ring: "ring-orange-400",
    height: "min-h-[170px]",
    emoji: "🥉",
    chip: "bg-orange-400 text-orange-950",
  },
};

function PodiumCard({ row, place }: { row: Row; place: 1 | 2 | 3 }) {
  const s = PLACE_STYLES[place];
  const winRate =
    row.matches > 0 ? Math.round((row.wins / row.matches) * 100) : 0;
  return (
    <motion.div
      layout
      className={`
        relative ${s.height} ${s.bg} ring-1 ${s.ring}
        rounded-2xl p-2 flex flex-col items-center text-center
        shadow-md
      `}
    >
      <div
        className={`
        absolute -top-2 left-1/2 -translate-x-1/2
        ${s.chip} rounded-full px-2 py-0.5 text-[11px] font-bold
        flex items-center gap-1
      `}
      >
        <span>{s.emoji}</span>
        <span>#{place}</span>
      </div>
      <div className="relative size-16 sm:size-20 rounded-xl bg-white/80 mt-2 mb-1.5 overflow-hidden">
        {row.image_url ? (
          <Image
            src={row.image_url}
            alt={row.name}
            fill
            sizes="80px"
            className="object-contain p-1"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-2xl">
            🍬
          </div>
        )}
      </div>
      <div className="font-semibold text-xs sm:text-sm leading-tight line-clamp-2 px-1">
        {row.name}
      </div>
      <div className="mt-auto pt-1 flex flex-col items-center text-[11px]">
        <div className="font-bold tabular-nums text-foreground/90">
          {Math.round(Number(row.elo))} ELO
        </div>
        <div className="text-foreground/70 tabular-nums">
          {winRate}% · {row.matches}
        </div>
      </div>
    </motion.div>
  );
}

function RankRow({
  row,
  rank,
  eloMin,
  eloMax,
}: {
  row: Row;
  rank: number;
  eloMin: number;
  eloMax: number;
}) {
  const winRate =
    row.matches > 0 ? Math.round((row.wins / row.matches) * 100) : 0;
  // ELO position [0..1] within the visible range
  const span = Math.max(1, eloMax - eloMin);
  const pct = Math.min(
    100,
    Math.max(0, ((Number(row.elo) - eloMin) / span) * 100),
  );

  return (
    <motion.div layout transition={{ type: "spring", stiffness: 240, damping: 28 }}>
      <Card className="flex items-center gap-3 p-2 sm:p-3 hover:shadow-md transition-shadow">
        <div className="w-8 text-center font-bold tabular-nums text-muted-foreground">
          {rank}
        </div>
        <div className="relative size-12 rounded-md overflow-hidden bg-muted/40 shrink-0">
          {row.image_url ? (
            <Image
              src={row.image_url}
              alt={row.name}
              fill
              sizes="48px"
              className="object-contain p-0.5"
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center">🍬</div>
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <div className="font-medium leading-tight truncate">{row.name}</div>
            <div className="font-semibold tabular-nums text-sm shrink-0">
              {Math.round(Number(row.elo))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-primary/70 to-primary"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <div className="text-[11px] text-muted-foreground tabular-nums shrink-0 min-w-[58px] text-right">
              {winRate}% · {row.matches}
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function BonusCard({
  icon,
  label,
  candy,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  candy: Row | undefined;
  note: string;
}) {
  if (!candy) return null;
  const winRate =
    candy.matches > 0 ? Math.round((candy.wins / candy.matches) * 100) : 0;
  return (
    <Card className="p-3 flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {icon}
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-2 min-w-0">
        <div className="relative size-9 rounded bg-muted/40 shrink-0">
          {candy.image_url && (
            <Image
              src={candy.image_url}
              alt={candy.name}
              fill
              sizes="36px"
              className="object-contain p-0.5"
              unoptimized
            />
          )}
        </div>
        <div className="text-sm font-medium truncate">{candy.name}</div>
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{note}</span>
        <span className="tabular-nums">{winRate}%</span>
      </div>
    </Card>
  );
}

