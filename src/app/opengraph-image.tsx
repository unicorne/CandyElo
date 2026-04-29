// Auto-generated Open Graph image for social previews.
// Next.js renders this on demand at /opengraph-image.
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "CandyElo — welche deutsche Süßigkeit gewinnt?";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #FFE9E1 0%, #FFD7A0 50%, #FFB7C5 100%)",
          fontFamily: "system-ui, sans-serif",
          color: "#3a1f17",
          padding: 80,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: 2,
            color: "#c2185b",
          }}
        >
          <span style={{ fontSize: 48 }}>🍬</span>
          CANDYELO
        </div>
        <div
          style={{
            fontSize: 100,
            fontWeight: 900,
            lineHeight: 1.05,
            marginTop: 20,
            textAlign: "center",
            letterSpacing: -2,
          }}
        >
          Welche Süßigkeit
          <br />
          gewinnt?
        </div>
        <div
          style={{
            fontSize: 32,
            marginTop: 40,
            color: "#5a3a30",
            textAlign: "center",
            maxWidth: 800,
          }}
        >
          Tipp auf deinen Favoriten. Live-Ranking aller deutschen Klassiker.
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            marginTop: 50,
            fontSize: 24,
            opacity: 0.8,
          }}
        >
          <span>candyelo.vercel.app</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
