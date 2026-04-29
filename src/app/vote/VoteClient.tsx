"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Flame, SkipForward, Trophy, Zap } from "lucide-react";
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

type FloatingDelta = {
  id: number;
  side: "left" | "right";
  delta: number;
};

function VsChip() {
  return (
    <div className="flex items-center justify-center self-center">
      <div className="size-10 sm:size-12 rounded-full bg-foreground text-background flex items-center justify-center text-xs sm:text-sm font-bold shadow-md select-none">
        VS
      </div>
    </div>
  );
}

export default function VoteClient() {
  const [pair, setPair] = useState<PairResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voteCount, setVoteCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [picked, setPicked] = useState<"a" | "b" | null>(null);
  const [floats, setFloats] = useState<FloatingDelta[]>([]);
  const floatId = useRef(0);

  const fetchPair = useCallback(
    async (excludeIds?: { a?: string; b?: string }) => {
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
    },
    [],
  );

  const loadNext = useCallback(
    async (excludeIds?: { a?: string; b?: string }) => {
      setLoading(true);
      setError(null);
      setPicked(null);
      try {
        const next = await fetchPair(excludeIds);
        setPair(next);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [fetchPair],
  );

  useEffect(() => {
    loadNext();
  }, [loadNext]);

  const haptic = useCallback(() => {
    try {
      const nav = navigator as unknown as { vibrate?: (p: number | number[]) => boolean };
      nav.vibrate?.(12);
    } catch {
      /* ignore */
    }
  }, []);

  const popFloat = useCallback((side: "left" | "right", delta: number) => {
    const id = ++floatId.current;
    setFloats((prev) => [...prev, { id, side, delta }]);
    setTimeout(() => {
      setFloats((prev) => prev.filter((f) => f.id !== id));
    }, 1100);
  }, []);

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
            toast.error("Token abgelaufen — lade neu.");
          } else {
            toast.error(`Vote fehlgeschlagen: ${body.error ?? res.status}`);
          }
          return null;
        }
        return typeof body.result?.winner_elo_delta === "number"
          ? body.result.winner_elo_delta
          : 0;
      } catch (e) {
        toast.error(`Netzwerkfehler: ${(e as Error).message}`);
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [],
  );

  const handlePick = useCallback(
    async (side: "a" | "b") => {
      if (!pair || submitting || picked) return;
      haptic();
      setPicked(side);
      const winner = side === "a" ? pair.a : pair.b;
      const loser = side === "a" ? pair.b : pair.a;
      const delta = await submitVote(winner, loser, pair.token);
      if (delta != null) {
        setVoteCount((c) => c + 1);
        setStreak((s) => s + 1);
        popFloat(side === "a" ? "left" : "right", delta);
        // short celebratory pause before swapping
        await new Promise((r) => setTimeout(r, 220));
        await loadNext({ a: loser.id });
      } else {
        setStreak(0);
        await loadNext();
      }
    },
    [pair, submitting, picked, submitVote, loadNext, haptic, popFloat],
  );

  const handleSkip = useCallback(async () => {
    if (loading || submitting) return;
    setStreak(0);
    await loadNext({ a: pair?.a.id, b: pair?.b.id });
  }, [pair, loadNext, loading, submitting]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft" || e.key === "1") handlePick("a");
      else if (e.key === "ArrowRight" || e.key === "2") handlePick("b");
      else if (e.key === " " || e.key === "s") {
        e.preventDefault();
        handleSkip();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlePick, handleSkip]);

  return (
    <div className="flex flex-1 flex-col">
      {/* sun-streak gradient */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(900px 500px at 50% -10%, color-mix(in oklab, var(--accent) 28%, transparent) 0%, transparent 60%)",
        }}
      />

      <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b bg-background/70 backdrop-blur sticky top-0 z-20">
        <Button asChild variant="ghost" size="sm">
          <Link href="/" aria-label="Zurück">
            <ArrowLeft className="size-4" />
            <span className="sr-only sm:not-sr-only sm:ml-1">Start</span>
          </Link>
        </Button>
        <div className="flex items-center gap-3 text-sm tabular-nums">
          <span className="flex items-center gap-1 text-foreground">
            <Zap className="size-4 text-primary" />
            <span className="font-semibold">{voteCount}</span>
          </span>
          {streak >= 3 && (
            <motion.span
              key={streak}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-1 text-amber-600"
            >
              <Flame className="size-4 fill-amber-500 text-amber-500" />
              <span className="font-semibold">{streak}</span>
            </motion.span>
          )}
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/leaderboard">
            <Trophy className="size-4" />
            <span className="sr-only sm:not-sr-only sm:ml-1">Ranking</span>
          </Link>
        </Button>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-3 py-5 sm:px-6 sm:py-8 gap-5">
        <h1 className="text-center text-xl sm:text-2xl font-bold tracking-tight">
          Was magst du <span className="text-primary">lieber?</span>
        </h1>

        {/* Stable card grid — never reflows. Cards always sit in cols [card | VS | card]. */}
        <div className="w-full max-w-3xl relative">
          <div
            className="
              grid grid-cols-[1fr_auto_1fr] gap-2 sm:gap-4 items-stretch
              min-h-[260px] sm:min-h-[360px] relative
            "
          >
            {error ? (
              <div className="col-span-3 text-center space-y-3 py-8">
                <p className="text-destructive">{error}</p>
                <Button onClick={() => loadNext()}>Nochmal versuchen</Button>
              </div>
            ) : loading || !pair ? (
              <>
                <CandyCardSkeleton />
                <VsChip />
                <CandyCardSkeleton />
              </>
            ) : (
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={`a-${pair.a.id}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="min-w-0"
                >
                  <CandyCard
                    candy={pair.a}
                    picked={picked === "a"}
                    dimmed={picked === "b"}
                    disabled={submitting || picked !== null}
                    onPick={() => handlePick("a")}
                  />
                </motion.div>
                <VsChip key="vs" />
                <motion.div
                  key={`b-${pair.b.id}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="min-w-0"
                >
                  <CandyCard
                    candy={pair.b}
                    picked={picked === "b"}
                    dimmed={picked === "a"}
                    disabled={submitting || picked !== null}
                    onPick={() => handlePick("b")}
                  />
                </motion.div>
              </AnimatePresence>
            )}

            {/* Floating ELO deltas — absolutely positioned, no layout impact */}
            <div className="pointer-events-none absolute inset-0">
              <AnimatePresence>
                {floats.map((f) => (
                  <motion.div
                    key={f.id}
                    initial={{ opacity: 0, y: 0, scale: 0.8 }}
                    animate={{ opacity: 1, y: -60, scale: 1 }}
                    exit={{ opacity: 0, y: -100, scale: 0.9 }}
                    transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
                    className={`absolute top-1/2 -translate-y-1/2 ${
                      f.side === "left" ? "left-[18%]" : "right-[18%]"
                    } text-2xl sm:text-3xl font-black text-primary drop-shadow-md`}
                  >
                    +{f.delta.toFixed(0)}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
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

        <p className="text-[10px] text-muted-foreground/60 select-none hidden sm:block">
          Tipp: ← / → oder 1 / 2 zum Wählen, Leertaste = überspringen
        </p>
      </main>
    </div>
  );
}
