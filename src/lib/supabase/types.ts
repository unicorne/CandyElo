export type Candy = {
  id: string;
  name: string;
  brand: string | null;
  image_url: string | null;
  kcal_100g: number | null;
  sugar_100g: number | null;
  fat_100g: number | null;
  ingredients_short: string | null;
  elo: number;
  matches: number;
  wins: number;
  created_at: string;
};

export type Vote = {
  id: string;
  winner_id: string;
  loser_id: string;
  voter_session: string | null;
  voter_ip_hash: string | null;
  pair_token: string | null;
  created_at: string;
};

export type CastVoteResult = {
  winner_id: string;
  loser_id: string;
  winner_elo_new: number;
  loser_elo_new: number;
  winner_elo_delta: number;
};
