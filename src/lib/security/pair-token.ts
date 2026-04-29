// Server-signed pair tokens (HMAC-SHA256 via jose).
// Each pair the server hands out gets a token; the client must POST it back
// with the vote. This makes it expensive to fabricate vote requests.
import { SignJWT, jwtVerify } from "jose";

const TTL_SECONDS = 60 * 5; // 5 min
const ISSUER = "candyelo";
const AUDIENCE = "vote";

let secretKey: Uint8Array | null = null;

function getSecret(): Uint8Array {
  if (secretKey) return secretKey;
  const raw = process.env.PAIR_TOKEN_SECRET;
  if (!raw) throw new Error("PAIR_TOKEN_SECRET not set");
  secretKey = new TextEncoder().encode(raw);
  return secretKey;
}

export type PairPayload = {
  a: string;
  b: string;
  iat: number;
};

export async function signPairToken(a: string, b: string): Promise<string> {
  const [first, second] = a < b ? [a, b] : [b, a];
  return await new SignJWT({ a: first, b: second })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyPairToken(token: string, winner: string, loser: string) {
  const { payload } = await jwtVerify(token, getSecret(), {
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  const { a, b } = payload as unknown as PairPayload;
  const want = winner < loser ? [winner, loser] : [loser, winner];
  if (a !== want[0] || b !== want[1]) {
    throw new Error("token does not match candy pair");
  }
  return payload as unknown as PairPayload;
}
