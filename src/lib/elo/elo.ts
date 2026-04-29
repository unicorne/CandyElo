export const ELO_K = 32;

export function expectedScore(a: number, b: number) {
  return 1 / (1 + Math.pow(10, (b - a) / 400));
}

export function eloDelta(winner: number, loser: number, k: number = ELO_K) {
  return k * (1 - expectedScore(winner, loser));
}
