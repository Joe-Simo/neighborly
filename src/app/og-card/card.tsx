import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import type { ReactNode } from "react";

/**
 * A shared link's picture, 1200 by 630, made once at build: the page's own head in Newsreader on the paper, beside its
 * own piece of the painting. The faces are the site's own, fixed at the weights the page sets (fonts.css), as TrueType
 * because the card's renderer reads no WOFF2. Every word on a card is one the page already says.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ink = "#283c32";
const paper = "#f5f3ec";
const here = join(process.cwd(), "src/app/og-card");

/**
 * What a card is made from, read once at build and kept, so the card is a fixed file rather than drawn on each visit.
 * The renderer reads PNG and JPEG, not WebP, so the painting is turned to PNG here.
 */
async function inputs(art: string) {
  "use cache";
  const [display, text, textStrong, png] = await Promise.all([
    readFile(join(here, "newsreader.ttf")),
    readFile(join(here, "source-sans-400.ttf")),
    readFile(join(here, "source-sans-600.ttf")),
    sharp(join(process.cwd(), "public", art)).png().toBuffer(),
  ]);
  return {
    fonts: [display, text, textStrong].map((font) => font.toString("base64")),
    picture: `data:image/png;base64,${png.toString("base64")}`,
  };
}

export async function card({ head, art, aside }: { head: string; art: string; aside?: ReactNode }) {
  const { fonts, picture } = await inputs(art);
  const [display, text, textStrong] = fonts.map((font) => Buffer.from(font, "base64"));
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: paper, color: ink, fontFamily: "Source Sans 3" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 660, padding: "64px 0 60px 72px" }}>
          <div style={{ fontFamily: "Newsreader", fontSize: 38, letterSpacing: -0.8, lineHeight: 1 }}>kind helps</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 34 }}>
            {/* The renderer leaves a word that starts with "Y" a space too wide after it (its kerned "Yo" is drawn but not measured),
                so that one space is set as a four-per-em space, which then reads as an ordinary one. */}
            <div style={{ display: "flex", fontFamily: "Newsreader", fontSize: 76, lineHeight: 0.98, letterSpacing: -2.4, width: 560 }}>
              {head.replace(/\b(Y\S*) /g, "$1\u2005")}
            </div>
            {aside}
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- the card is drawn by the image renderer, not served as a page */}
        <img src={picture} alt="" width={540} height={630} style={{ width: 540, height: 630, objectFit: "cover" }} />
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Newsreader", data: display, weight: 400, style: "normal" },
        { name: "Source Sans 3", data: text, weight: 400, style: "normal" },
        { name: "Source Sans 3", data: textStrong, weight: 600, style: "normal" },
      ],
    },
  );
}

/** A slip as the home page lays it: the caller's name and the call, on a sheet of its own. */
export function Slip({ name, call }: { name: string; call: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 420, padding: "18px 24px 20px", background: "#fbf9f3", border: "1px solid #ddd6c6", boxShadow: "0 14px 28px -16px rgba(40,60,50,0.45)" }}>
      <div style={{ fontWeight: 600, fontSize: 22 }}>{name}</div>
      <div style={{ fontFamily: "Newsreader", fontSize: 30, letterSpacing: -0.6 }}>{call}</div>
    </div>
  );
}

/** The year in paper's totals, each figure over its label. */
export function Totals({ items }: { items: { value: string; label: string }[] }) {
  return (
    <div style={{ display: "flex", gap: 24, width: 560 }}>
      {items.map((item) => (
        <div key={item.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontFamily: "Newsreader", fontSize: 46, letterSpacing: -1.2, lineHeight: 1 }}>{item.value}</div>
          <div style={{ fontWeight: 600, fontSize: 15, letterSpacing: 1.6, textTransform: "uppercase", color: "#4f5d52", maxWidth: 170 }}>{item.label}</div>
        </div>
      ))}
    </div>
  );
}
