import { ImageResponse, loadGoogleFont } from "workers-og";
import type { Gem } from "./index";

const WIDTH = 1200;
const HEIGHT = 630;
const AVATAR_PX = 96;
const AVATAR_FETCH_SIZE = 200;

let fontCache: ArrayBuffer | null = null;

async function getFont(text: string): Promise<ArrayBuffer> {
  if (fontCache) return fontCache;
  fontCache = await loadGoogleFont({ family: "Inter", weight: 700, text });
  return fontCache;
}

export async function renderCard(gem: Gem): Promise<Response> {
  const avatars = await Promise.all(
    gem.owners.map(async (o) => ({
      handle: o.handle,
      dataUri: await fetchAvatar(o.id),
    })),
  );

  const downloads = formatDownloads(gem.downloads);
  const info = truncate(gem.info, 160);
  const versionLabel = gem.version ? `v${gem.version}` : "";

  const html = `
<div style="display:flex;flex-direction:column;width:100%;height:100%;background:#b12704;color:#ffffff;padding:64px 72px;font-family:Inter,sans-serif;justify-content:space-between;">
  <div style="display:flex;align-items:center;justify-content:space-between;">
    <div style="display:flex;align-items:center;gap:16px;">
      <div style="display:flex;align-items:center;justify-content:center;width:72px;height:72px;border-radius:18px;background:#ffffff;color:#b12704;font-size:48px;font-weight:700;">R</div>
      <div style="display:flex;font-size:32px;font-weight:700;letter-spacing:0.04em;color:#fcd7c8;">RubyGems</div>
    </div>
    ${versionLabel ? `<div style="display:flex;font-size:34px;font-weight:700;color:#ffe4dc;">${escapeHtml(versionLabel)}</div>` : ""}
  </div>

  <div style="display:flex;flex-direction:column;">
    <div style="display:flex;font-size:84px;font-weight:700;line-height:1.05;word-break:break-all;">${escapeHtml(gem.name)}</div>
    ${info ? `<div style="display:flex;margin-top:24px;font-size:30px;line-height:1.35;color:#ffe4dc;">${escapeHtml(info)}</div>` : ""}
  </div>

  <div style="display:flex;align-items:center;justify-content:space-between;">
    <div style="display:flex;align-items:center;gap:-24px;">
      ${avatars
        .map(
          (a, i) =>
            `<div style="display:flex;width:${AVATAR_PX}px;height:${AVATAR_PX}px;border-radius:9999px;overflow:hidden;border:4px solid #ffffff;margin-left:${i === 0 ? 0 : -24}px;background:#ffffff;">
              ${a.dataUri ? `<img src="${a.dataUri}" width="${AVATAR_PX - 8}" height="${AVATAR_PX - 8}" style="border-radius:9999px;" />` : `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:36px;font-weight:700;color:#b12704;">${escapeHtml(a.handle.slice(0, 1).toUpperCase())}</div>`}
            </div>`,
        )
        .join("")}
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;">
      <div style="display:flex;font-size:54px;font-weight:700;">${escapeHtml(downloads)}</div>
      <div style="display:flex;font-size:24px;color:#ffe4dc;letter-spacing:0.06em;">DOWNLOADS</div>
    </div>
  </div>
</div>`;

  const fontText = `${gem.name}${gem.version}${info}${downloads}RubyGemsDOWNLOADSv0123456789${gem.owners.map((o) => o.handle).join("")}`;
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

async function fetchAvatar(userId: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://rubygems.org/users/${userId}/avatar.jpeg?size=${AVATAR_FETCH_SIZE}`,
      { headers: { accept: "image/*" } },
    );
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const ct = res.headers.get("content-type") ?? "image/jpeg";
    return `data:${ct};base64,${arrayBufferToBase64(buf)}`;
  } catch {
    return null;
  }
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
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
