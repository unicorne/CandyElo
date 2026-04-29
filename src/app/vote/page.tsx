import VoteClient from "./VoteClient";
import { TurnstileGate } from "@/components/candy/TurnstileGate";

export const dynamic = "force-dynamic";

export default function VotePage() {
  return (
    <TurnstileGate>
      <VoteClient />
    </TurnstileGate>
  );
}
