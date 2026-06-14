import type { Gem } from "./index";

export type OgpInput = {
  gem: Gem;
  imageUrl: string | null;
};

export function renderOgp({ gem, imageUrl }: OgpInput): string {
  const title = `${gem.name}${gem.version ? ` ${gem.version}` : ""}`;
  const description = buildDescription(gem);
  const t = htmlEscape(title);
  const d = htmlEscape(description);
  const url = htmlEscape(gem.rubygemsUrl);
  const img = imageUrl ? htmlEscape(imageUrl) : "";
  const card = img ? "summary_large_image" : "summary";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${t}</title>
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:title" content="${t}">
<meta property="og:url" content="${url}">
${img ? `<meta property="og:image" content="${img}">` : ""}
${d ? `<meta property="og:description" content="${d}">` : ""}
<meta name="twitter:card" content="${card}">
<meta name="twitter:title" content="${t}">
${img ? `<meta name="twitter:image" content="${img}">` : ""}
${d ? `<meta name="twitter:description" content="${d}">` : ""}
<meta http-equiv="refresh" content="0;url=${url}">
</head>
<body>
<p>Redirecting to <a href="${url}">${url}</a></p>
</body>
</html>`;
}

function buildDescription(gem: Gem): string {
  const parts: string[] = [];
  if (gem.info) parts.push(gem.info);
  const meta: string[] = [];
  if (gem.authors) meta.push(`by ${gem.authors}`);
  if (gem.downloads) meta.push(`${formatDownloads(gem.downloads)} downloads`);
  if (meta.length > 0) parts.push(meta.join(" • "));
  return parts.join(" — ").slice(0, 200);
}

function formatDownloads(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
