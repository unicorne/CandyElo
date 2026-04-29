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

const SWAP_DELAY_MS = 220;

export default function VoteClient() {
  const [pair, setPair] = useState<PairResponse | null>(null);
  const [nextPair, setNextPair] = useState<PairResponse | null>(null);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [voteCount, setVoteCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [picked, setPicked] = useState<"a" | "b" | null>(null);
  const [floats, setFloats] = useState<FloatingDelta[]>([]);
  const floatId = useRef(0);
  const prefetchInFlight = useRef(false);

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

  const prefetchNext = useCallback(
    async (excludeA?: string, excludeB?: string) => {
      if (prefetchInFlight.current) return;
      prefetchInFlight.current = true;
      try {
        const next = await fetchPair({ a: excludeA, b: excludeB });
        setNextPair(next);
      } catch {
        /* swallow — we'll fall back to a synchronous fetch on swap */
      } finally {
        prefetchInFlight.current = false;
      }
    },
    [fetchPair],
  );

  // First load: fetch current pair, then immediately prefetch the next.
  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const first = await fetchPair();
        if (canceled) return;
        setPair(first);
        prefetchNext(first.a.id, first.b.id);
      } catch (e) {
        if (!canceled) setInitialError((e as Error).message);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [fetchPair, prefetchNext]);

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
      }
    },
    [],
  );

  const handlePick = useCallback(
    async (side: "a" | "b") => {
      if (!pair || picked) return;
      haptic();
      setPicked(side);

      const winner = side === "a" ? pair.a : pair.b;
      const loser = side === "a" ? pair.b : pair.a;
      const token = pair.token;
      const floatSide: "left" | "right" = side === "a" ? "left" : "right";

      // Fire the vote API but don't block the swap on it.
      const votePromise = submitVote(winner, loser, token);

      // Race: if the API confirms in <SWAP_DELAY_MS, show the +ELO float
      // before we swap. Otherwise it lands silently after the swap.
      const minWait = new Promise<"timeout">((r) =>
        setTimeout(() => r("timeout"), SWAP_DELAY_MS),
      );
      const raced = await Promise.race([votePromise, minWait]);
      if (raced !== "timeout" && typeof raced === "number") {
        popFloat(floatSide, raced);
      }

      // Swap to the prefetched next pair if we have it, else fetch synchronously.
      let upcoming = nextPair;
      if (!upcoming) {
        try {
          upcoming = await fetchPair({ a: loser.id });
        } catch (e) {
          toast.error(`Konnte kein neues Paar laden: ${(e as Error).message}`);
        }
      }
      if (upcoming) {
        setPair(upcoming);
        setNextPair(null);
        setPicked(null);
        prefetchNext(upcoming.a.id, upcoming.b.id);
      } else {
        setPicked(null);
      }

      // Reconcile counters & streak with the real API outcome (which may still
      // be pending). Don't update toast here — already shown above on errors.
      void votePromise.then((delta) => {
        if (delta != null) {
          setVoteCount((c) => c + 1);
          setStreak((s) => s + 1);
        } else {
          setStreak(0);
        }
      });
    },
    [pair, picked, haptic, submitVote, nextPair, fetchPair, prefetchNext, popFloat],
  );

  const handleSkip = useCallback(async () => {
    if (!pair || picked) return;
    setStreak(0);
    let upcoming = nextPair;
    if (!upcoming) {
      try {
        upcoming = await fetchPair({ a: pair.a.id, b: pair.b.id });
      } catch (e) {
        toast.error(`Fehler: ${(e as Error).message}`);
        return;
      }
    }
    setPair(upcoming);
    setNextPair(null);
    prefetchNext(upcoming.a.id, upcoming.b.id);
  }, [pair, picked, nextPair, fetchPair, prefetchNext]);

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

        <div className="w-full max-w-3xl relative">
          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 sm:gap-4 items-stretch min-h-[260px] sm:min-h-[360px] relative">
            {initialError ? (
              <div className="col-span-3 text-center space-y-3 py-8">
                <p className="text-destructive">{initialError}</p>
                <Button onClick={() => window.location.reload()}>Neu laden</Button>
              </div>
            ) : !pair ? (
              <>
                <CandyCardSkeleton />
                <VsChip />
                <CandyCardSkeleton />
              </>
            ) : (
              <>
                <CardSlot
                  pair={pair}
                  which="a"
                  picked={picked}
                  onPick={() => handlePick("a")}
                />
                <VsChip />
                <CardSlot
                  pair={pair}
                  which="b"
                  picked={picked}
                  onPick={() => handlePick("b")}
                />
              </>
            )}

            {/* Floating ELO deltas — absolutely positioned, zero layout impact */}
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
          disabled={!pair || picked !== null}
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

// One grid slot. Keyed by candy id so swapping the pair triggers a clean
// cross-fade exactly in this slot — no layout reflow, no skeleton flash.
function CardSlot({
  pair,
  which,
  picked,
  onPick,
}: {
  pair: PairResponse;
  which: "a" | "b";
  picked: "a" | "b" | null;
  onPick: () => void;
}) {
  const candy = which === "a" ? pair.a : pair.b;
  const isPicked = picked === which;
  const isDimmed = picked != null && picked !== which;

  return (
    <div className="min-w-0 relative">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={candy.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="h-full"
        >
          <CandyCard
            candy={candy}
            picked={isPicked}
            dimmed={isDimmed}
            disabled={picked !== null}
            onPick={onPick}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
