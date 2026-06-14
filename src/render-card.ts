import { ImageResponse, loadGoogleFont } from "workers-og";
import type { Gem } from "./index";

const WIDTH = 1200;
const HEIGHT = 630;

let fontCache: ArrayBuffer | null = null;

async function getFont(text: string): Promise<ArrayBuffer> {
  if (fontCache) return fontCache;
  fontCache = await loadGoogleFont({ family: "Inter", weight: 700, text });
  return fontCache;
}

export async function renderCard(gem: Gem): Promise<Response> {
  const html = gem.isSpecificVersion ? renderVersionCard(gem) : renderGemCard(gem);

  const ascii =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,!?@#$%&*()-_+=:;'\"/<>";
  const fontText = `${ascii}${gem.name}${gem.version}${gem.info}${gem.authors}`;
  const fontData = await getFont(fontText);

  return new ImageResponse(html, {
    width: WIDTH,
    height: HEIGHT,
    format: "png",
    fonts: [{ name: "Inter", data: fontData, weight: 700, style: "normal" }],
    headers: {
      "cache-control": "public, max-age=604800",
    },
  });
}

function renderGemCard(gem: Gem): string {
  const downloads = formatDownloads(gem.downloads);
  const info = truncate(gem.info, 180);
  const authors = truncate(gem.authors, 60);
  const titleSize = pickTitleSize(gem.name, gem.version);

  return `
<div style="display:flex;flex-direction:column;width:100%;height:100%;background:#b12704;color:#ffffff;padding:64px 72px;font-family:Inter,sans-serif;justify-content:space-between;">
  <div style="display:flex;align-items:center;justify-content:flex-start;">
    ${header()}
  </div>

  <div style="display:flex;flex-direction:column;align-items:flex-start;">
    <div style="display:flex;align-items:baseline;gap:24px;flex-wrap:wrap;">
      <div style="display:flex;font-size:${titleSize}px;font-weight:700;line-height:1.05;letter-spacing:-0.02em;word-break:break-all;">${escapeHtml(gem.name)}</div>
      ${gem.version ? `<div style="display:flex;font-size:${Math.round(titleSize * 0.55)}px;font-weight:700;line-height:1.05;letter-spacing:-0.02em;color:#ffe4dc;">${escapeHtml(`v${gem.version}`)}</div>` : ""}
    </div>
    ${info ? `<div style="display:flex;margin-top:28px;font-size:32px;line-height:1.35;color:#ffe4dc;">${escapeHtml(info)}</div>` : ""}
  </div>

  ${footer(authors, downloads, "DOWNLOADS")}
</div>`;
}

function renderVersionCard(gem: Gem): string {
  const released = formatDate(gem.versionCreatedAt);
  const info = truncate(gem.info, 140);
  const authors = truncate(gem.authors, 60);
  const versionDl = gem.versionDownloads != null ? formatDownloads(gem.versionDownloads) : null;
  const totalDl = formatDownloads(gem.downloads);
  const titleSize = pickTitleSize(gem.name, gem.version);

  return `
<div style="display:flex;flex-direction:column;width:100%;height:100%;background:#b12704;color:#ffffff;padding:56px 72px;font-family:Inter,sans-serif;justify-content:space-between;">
  <div style="display:flex;align-items:center;justify-content:flex-start;">
    ${header()}
  </div>

  <div style="display:flex;flex-direction:column;align-items:flex-start;">
    <div style="display:flex;align-items:baseline;gap:28px;flex-wrap:wrap;">
      <div style="display:flex;font-size:${titleSize}px;font-weight:700;line-height:1.05;letter-spacing:-0.02em;word-break:break-all;">${escapeHtml(gem.name)}</div>
      <div style="display:flex;font-size:${titleSize}px;font-weight:700;line-height:1.05;letter-spacing:-0.02em;color:#ffe4dc;">${escapeHtml(`v${gem.version}`)}</div>
    </div>
    ${released ? `<div style="display:flex;margin-top:20px;align-items:baseline;gap:14px;"><div style="display:flex;font-size:22px;color:#fcd7c8;letter-spacing:0.08em;">RELEASED</div><div style="display:flex;font-size:40px;font-weight:700;">${escapeHtml(released)}</div></div>` : ""}
    ${info ? `<div style="display:flex;margin-top:20px;font-size:28px;line-height:1.35;color:#ffe4dc;">${escapeHtml(info)}</div>` : ""}
  </div>

  ${footer(authors, versionDl ?? totalDl, versionDl ? "THIS VERSION" : "DOWNLOADS")}
</div>`;
}

function pickTitleSize(name: string, version: string): number {
  const total = name.length + 1 + `v${version}`.length;
  if (total <= 16) return 110;
  if (total <= 22) return 90;
  if (total <= 30) return 72;
  return 60;
}

function header(): string {
  return `<div style="display:flex;align-items:center;gap:16px;">
      <div style="display:flex;align-items:center;justify-content:center;width:72px;height:72px;border-radius:18px;background:#ffffff;color:#b12704;font-size:48px;font-weight:700;">R</div>
      <div style="display:flex;font-size:32px;font-weight:700;letter-spacing:0.04em;color:#fcd7c8;">RubyGems</div>
    </div>`;
}

function footer(authors: string, count: string, countLabel: string): string {
  return `<div style="display:flex;align-items:flex-end;justify-content:space-between;">
    ${authors ? `<div style="display:flex;flex-direction:column;max-width:60%;"><div style="display:flex;font-size:22px;color:#fcd7c8;letter-spacing:0.06em;">BY</div><div style="display:flex;font-size:32px;font-weight:700;">${escapeHtml(authors)}</div></div>` : `<div style="display:flex;"></div>`}
    <div style="display:flex;flex-direction:column;align-items:flex-end;">
      <div style="display:flex;font-size:60px;font-weight:700;">${escapeHtml(count)}</div>
      <div style="display:flex;font-size:24px;color:#ffe4dc;letter-spacing:0.06em;">${escapeHtml(countLabel)}</div>
    </div>
  </div>`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = months[Number.parseInt(m[2], 10) - 1] ?? m[2];
  return `${month} ${Number.parseInt(m[3], 10)}, ${m[1]}`;
}

function formatDownloads(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trimEnd()}…`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
