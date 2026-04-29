"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, SkipForward, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CandyCard, CandyCardSkeleton } from "@/components/candy/CandyCard";
import type { Candy } from "@/lib/supabase/types";

type CandyDTO = Pick<
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

type PairResponse = {
  a: CandyDTO;
  b: CandyDTO;
  token: string;
};

export default function VoteClient() {
  const [pair, setPair] = useState<PairResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voteCount, setVoteCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const lastPairIds = useRef<{ a: string; b: string } | null>(null);

  const fetchPair = useCallback(async (excludeIds?: { a?: string; b?: string }) => {
    const qs = new URLSearchParams();
    if (excludeIds?.a) qs.set("excludeA", excludeIds.a);
    if (excludeIds?.b) qs.set("excludeB", excludeIds.b);
    const res = await fetch(`/api/pair${qs.toString() ? `?${qs}` : ""}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || `pair fetch failed (${res.status})`);
    }
    return (await res.json()) as PairResponse;
  }, []);

  const loadNext = useCallback(async (excludeIds?: { a?: string; b?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchPair(excludeIds);
      setPair(next);
      lastPairIds.current = { a: next.a.id, b: next.b.id };
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [fetchPair]);

  useEffect(() => {
    loadNext();
  }, [loadNext]);

  const submitVote = useCallback(
    async (winner: CandyDTO, loser: CandyDTO, token: string) => {
      setSubmitting(true);
      try {
        const res = await fetch("/api/vote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            winnerId: winner.id,
            loserId: loser.id,
            token,
          }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          result?: { winner_elo_delta?: number };
        };
        if (!res.ok) {
          if (res.status === 429 && body.error === "daily-cap") {
            toast.error("Du hast dein Tageslimit erreicht. Komm morgen wieder!");
          } else if (res.status === 429 && body.error === "too-fast") {
            toast.warning("Bitte etwas langsamer 🙂");
          } else if (res.status === 401) {
            toast.error("Token abgelaufen — neue Paarung wird geladen.");
          } else {
            toast.error(`Vote fehlgeschlagen: ${body.error ?? res.status}`);
          }
          return false;
        }
        const delta = body.result?.winner_elo_delta;
        if (typeof delta === "number") {
          toast.success(`+${delta.toFixed(1)} ELO für ${winner.name}`, {
            duration: 1300,
          });
        }
        setVoteCount((c) => c + 1);
        return true;
      } catch (e) {
        toast.error(`Netzwerkfehler: ${(e as Error).message}`);
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [],
  );

  const handlePick = useCallback(
    async (winner: CandyDTO, loser: CandyDTO) => {
      if (!pair || submitting) return;
      const ok = await submitVote(winner, loser, pair.token);
      if (ok) {
        await loadNext({ a: loser.id });
      } else {
        await loadNext();
      }
    },
    [pair, submitting, submitVote, loadNext],
  );

  const handleSkip = useCallback(async () => {
    await loadNext({ a: pair?.a.id, b: pair?.b.id });
  }, [pair, loadNext]);

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b">
        <Button asChild variant="ghost" size="sm">
          <Link href="/" aria-label="Zurück">
            <ArrowLeft className="size-4" />
            <span className="sr-only sm:not-sr-only sm:ml-1">Start</span>
          </Link>
        </Button>
        <div className="text-sm text-muted-foreground tabular-nums">
          {voteCount} Vote{voteCount === 1 ? "" : "s"}
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/leaderboard">
            <Trophy className="size-4" />
            <span className="sr-only sm:not-sr-only sm:ml-1">Ranking</span>
          </Link>
        </Button>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-3 py-4 sm:px-6 sm:py-8 gap-4">
        <h1 className="text-center text-base sm:text-lg font-medium text-muted-foreground">
          Welche schmeckt dir besser?
        </h1>

        <div className="w-full max-w-3xl">
          <AnimatePresence mode="wait">
            {loading || !pair ? (
              <motion.div
                key="loading"
                className="flex gap-3 sm:gap-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <CandyCardSkeleton />
                <CandyCardSkeleton />
              </motion.div>
            ) : error ? (
              <motion.div
                key="error"
                className="text-center space-y-3 py-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <p className="text-destructive">{error}</p>
                <Button onClick={() => loadNext()}>Nochmal versuchen</Button>
              </motion.div>
            ) : (
              <motion.div
                key={`${pair.a.id}-${pair.b.id}`}
                className="flex gap-3 sm:gap-6 items-stretch"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.18 }}
              >
                <CandyCard
                  candy={pair.a}
                  side="left"
                  disabled={submitting}
                  onPick={() => handlePick(pair.a, pair.b)}
                />
                <div className="flex items-center justify-center text-xs sm:text-sm font-bold text-muted-foreground self-center select-none">
                  vs
                </div>
                <CandyCard
                  candy={pair.b}
                  side="right"
                  disabled={submitting}
                  onPick={() => handlePick(pair.b, pair.a)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleSkip}
          disabled={loading || submitting}
          className="text-muted-foreground"
        >
          <SkipForward className="size-4 mr-1" />
          Kenne ich beide nicht
        </Button>
      </main>
    </div>
  );
}
