import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="max-w-md flex flex-col gap-8 items-center">
        <div className="text-6xl">🍬</div>
        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight">CandyElo</h1>
          <p className="text-muted-foreground text-lg">
            Welche deutsche Süßigkeit ist die beliebteste? Stimme ab und finde
            es heraus.
          </p>
        </div>
        <div className="flex flex-col w-full gap-3">
          <Button asChild size="lg" className="h-14 text-lg">
            <Link href="/vote">Jetzt abstimmen</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-14 text-lg">
            <Link href="/leaderboard">Live-Ranking ansehen</Link>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          ELO-Ranking · Open Food Facts · keine Anmeldung nötig
        </p>
      </div>
    </main>
  );
}
