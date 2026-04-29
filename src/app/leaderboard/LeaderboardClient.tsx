"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Vote, Crown, Heart, ThumbsDown } from "lucide-react";
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
              (a, b) => Number(b.elo) - Number(a.elo) || b.matches - a.matches,
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

  const bonus = useMemo(() => {
    if (!rows) return null;
    const played = rows.filter((r) => r.matches >= 3);
    if (played.length < 3) return null;
    const byElo = [...played].sort((a, b) => Number(b.elo) - Number(a.elo));
    const lowest = byElo[byElo.length - 1];
    const winRate = (r: Row) => (r.matches > 0 ? r.wins / r.matches : 0);
    const eloThresh = byElo[Math.floor(byElo.length * 0.4)]?.elo ?? 1500;
    const underrated = [...played]
      .filter((r) => Number(r.elo) <= Number(eloThresh))
      .sort((a, b) => winRate(b) - winRate(a))[0];
    return { mostHated: lowest, mostUnderrated: underrated };
  }, [rows]);

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b">
        <Button asChild variant="ghost" size="sm">
          <Link href="/" aria-label="Zurück">
            <ArrowLeft className="size-4" />
            <span className="sr-only sm:not-sr-only sm:ml-1">Start</span>
          </Link>
        </Button>
        <h1 className="text-base font-semibold flex items-center gap-1.5">
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

        {bonus && (
          <section className="grid grid-cols-2 gap-3">
            <BonusCard
              icon={<Heart className="size-4 text-pink-500" />}
              label="Most Underrated"
              candy={bonus.mostUnderrated}
              note="hohe Sieg-Quote, niedriges ELO"
            />
            <BonusCard
              icon={<ThumbsDown className="size-4 text-zinc-500" />}
              label="Most Hated"
              candy={bonus.mostHated}
              note="niedrigstes ELO"
            />
          </section>
        )}

        <section className="space-y-2">
          {rows === null
            ? Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))
            : rows.map((r, i) => (
                <motion.div
                  key={r.id}
                  layout
                  transition={{ type: "spring", stiffness: 240, damping: 28 }}
                >
                  <Card className="flex items-center gap-3 p-2 sm:p-3">
                    <div className="w-8 text-center font-bold tabular-nums text-muted-foreground">
                      {i + 1}
                    </div>
                    <div className="relative size-12 rounded-md overflow-hidden bg-muted/40 shrink-0">
                      {r.image_url ? (
                        <Image
                          src={r.image_url}
                          alt={r.name}
                          fill
                          sizes="48px"
                          className="object-contain p-0.5"
                          unoptimized
                        />
                      ) : (
                        <div className="absolute inset-0 grid place-items-center">🍬</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium leading-tight truncate">{r.name}</div>
                      {r.brand && (
                        <div className="text-xs text-muted-foreground truncate">
                          {r.brand}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-semibold tabular-nums">
                        {Math.round(Number(r.elo))}
                      </div>
                      <div className="text-[10px] text-muted-foreground tabular-nums">
                        {r.matches} Matches
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
        </section>
      </main>
    </div>
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
      <p className="text-[10px] text-muted-foreground">{note}</p>
    </Card>
  );
}
