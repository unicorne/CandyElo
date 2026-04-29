"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Crown, Share2, Sparkles, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type CandyMini = {
  id: string;
  name: string;
  brand: string | null;
  image_url: string | null;
};

type Stats = {
  votes: number;
  candies: number;
  leader: (CandyMini & { elo: number; matches: number }) | null;
  previewPair: { a: CandyMini; b: CandyMini } | null;
};

const fmtNumber = new Intl.NumberFormat("de-DE");

export default function HomeClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [pair, setPair] = useState<{ a: CandyMini; b: CandyMini } | null>(null);

  // Initial stats fetch
  useEffect(() => {
    let canceled = false;
    fetch("/api/stats", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: Stats) => {
        if (canceled) return;
        setStats(data);
        if (data.previewPair) setPair(data.previewPair);
      })
      .catch(() => {});
    return () => {
      canceled = true;
    };
  }, []);

  // Cycle the preview pair every 3.2s for a sense of motion
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/pair", { cache: "no-store" });
        if (!res.ok) return;
        const j = (await res.json()) as { a: CandyMini; b: CandyMini };
        setPair({ a: j.a, b: j.b });
      } catch {
        /* ignore */
      }
    }, 3200);
    return () => clearInterval(id);
  }, []);

  async function share() {
    const url = "https://candyelo.vercel.app";
    const text = "Welche deutsche Süßigkeit ist die beliebteste? Stimm ab 🍬";
    const data = { title: "CandyElo", text, url };
    try {
      const navAny = navigator as unknown as {
        share?: (d: { title: string; text: string; url: string }) => Promise<void>;
        canShare?: (d: { url: string }) => boolean;
      };
      if (navAny.share && (!navAny.canShare || navAny.canShare({ url }))) {
        await navAny.share(data);
        return;
      }
    } catch {
      /* fallthrough to copy */
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link kopiert! Schick ihn deinen Freunden.");
    } catch {
      toast.error("Konnte den Link nicht kopieren.");
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* sun-streak gradient backdrop */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(1100px 600px at 80% -10%, color-mix(in oklab, var(--accent) 35%, transparent) 0%, transparent 60%), radial-gradient(900px 500px at -10% 110%, color-mix(in oklab, var(--primary) 22%, transparent) 0%, transparent 55%)",
        }}
      />

      <main className="flex flex-1 flex-col items-center justify-center px-5 py-8 sm:py-12">
        <div className="w-full max-w-md flex flex-col items-center gap-6">
          {/* Brand */}
          <div className="flex items-center gap-2 text-sm font-semibold tracking-wide text-primary">
            <span className="size-2 rounded-full bg-primary animate-pulse" />
            CANDYELO · LIVE
          </div>

          {/* Headline */}
          <div className="space-y-3 text-center">
            <h1 className="text-5xl sm:text-6xl font-black tracking-tight leading-[0.95]">
              Welche{" "}
              <span className="bg-gradient-to-br from-primary to-accent bg-clip-text text-transparent">
                Süßigkeit
              </span>
              <br />
              gewinnt?
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground px-2">
              Tipp auf deinen Favoriten. Zwei Karten, ein Sieger. Das Ranking
              entsteht live aus allen Stimmen.
            </p>
          </div>

          {/* Live preview */}
          <PreviewPair pair={pair} />

          {/* Primary CTA */}
          <div className="w-full flex flex-col gap-2.5 mt-1">
            <Button
              asChild
              size="lg"
              className="h-14 text-lg font-semibold shadow-lg shadow-primary/25 group"
            >
              <Link href="/vote" aria-label="Jetzt abstimmen">
                Jetzt abstimmen
                <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
            <div className="grid grid-cols-2 gap-2.5">
              <Button asChild variant="outline" size="lg" className="h-12">
                <Link href="/leaderboard">
                  <Trophy className="size-4" />
                  Ranking
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-12"
                onClick={share}
              >
                <Share2 className="size-4" />
                Teilen
              </Button>
            </div>
          </div>

          {/* Stats strip */}
          <Stats stats={stats} />
        </div>

        {/* Tiny footer */}
        <p className="mt-10 text-[11px] uppercase tracking-wider text-muted-foreground/70">
          ELO · Open Food Facts · ohne Anmeldung
        </p>
      </main>
    </div>
  );
}

function PreviewPair({ pair }: { pair: { a: CandyMini; b: CandyMini } | null }) {
  return (
    <div className="relative w-full">
      <div className="grid grid-cols-2 gap-3 items-stretch">
        <AnimatePresence mode="popLayout">
          {pair && (
            <PreviewCard
              key={`A-${pair.a.id}`}
              candy={pair.a}
              side="left"
            />
          )}
        </AnimatePresence>
        <AnimatePresence mode="popLayout">
          {pair && (
            <PreviewCard
              key={`B-${pair.b.id}`}
              candy={pair.b}
              side="right"
            />
          )}
        </AnimatePresence>
      </div>
      {/* center vs */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <div className="size-10 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-bold shadow-md">
          VS
        </div>
      </div>
    </div>
  );
}

function PreviewCard({ candy, side }: { candy: CandyMini; side: "left" | "right" }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: side === "left" ? -10 : 10, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="relative aspect-square rounded-2xl bg-card border overflow-hidden flex items-end p-3"
    >
      {candy.image_url && (
        <Image
          src={candy.image_url}
          alt={candy.name}
          fill
          sizes="(max-width: 640px) 50vw, 200px"
          className="object-contain p-3"
          unoptimized
          priority
        />
      )}
      <div className="relative z-10 text-[11px] font-semibold tabular-nums leading-tight bg-background/85 backdrop-blur px-2 py-1 rounded-md max-w-full truncate">
        {candy.name}
      </div>
    </motion.div>
  );
}

function Stats({ stats }: { stats: Stats | null }) {
  return (
    <div className="w-full grid grid-cols-3 gap-2 mt-2">
      <StatBox label="Votes" value={stats ? fmtNumber.format(stats.votes) : "…"} icon={<Sparkles className="size-3.5" />} />
      <StatBox label="Süßigkeiten" value={stats ? fmtNumber.format(stats.candies) : "…"} icon={<span className="text-sm">🍬</span>} />
      <StatBox
        label="#1"
        value={stats?.leader ? truncate(stats.leader.name, 14) : "…"}
        icon={<Crown className="size-3.5 text-amber-500" />}
      />
    </div>
  );
}

function StatBox({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-card/60 border px-2 py-2 text-center">
      <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 font-semibold text-sm tabular-nums truncate">{value}</div>
    </div>
  );
}

function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}
