import indexHtml from "./index.html";
import { renderCard } from "./render-card";
import { renderOgp } from "./render-ogp";

const RUBYGEMS_HOST = "rubygems.org";

interface Env {
  CACHE_VERSION: string;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const refresh = url.searchParams.get("refresh") === "1";

    const gem = url.pathname.match(/^\/gems\/([a-zA-Z0-9_.-]+?)\/?$/);
    if (gem) {
      const name = gem[1];
      const ua = req.headers.get("user-agent") ?? "";
      if (!isCrawler(ua)) {
        return Response.redirect(`https://${RUBYGEMS_HOST}/gems/${name}`, 302);
      }
      return ogpPage(name, url.origin, env, refresh);
    }

    const img = url.pathname.match(/^\/img\/([a-zA-Z0-9_.-]+?)\.png\/?$/);
    if (img) {
      return cardImage(img[1], env, refresh);
    }

    const api = url.pathname.match(/^\/api\/preview\/([a-zA-Z0-9_.-]+?)\/?$/);
    if (api) {
      return previewApi(api[1], env, refresh);
    }

    if (url.pathname === "/" || url.pathname === "") {
      const input = url.searchParams.get("url");
      if (input) {
        const name = extractGemName(input);
        if (name) {
          return Response.redirect(`${url.origin}/gems/${name}`, 302);
        }
      }
      return new Response(indexHtml, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

function extractGemName(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const m = trimmed.match(/rubygems\.org\/gems\/([a-zA-Z0-9_.-]+)/i);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_.-]+$/.test(trimmed)) return trimmed;
  return null;
}

function isCrawler(ua: string): boolean {
  return /bot|crawler|spider|facebookexternalhit|slackbot|linkedinbot|whatsapp|telegrambot|pinterest|embedly|developers\.google\.com\/\+\/web\/snippet/i.test(
    ua,
  );
}

type Owner = { id: number; handle: string };

export type Gem = {
  name: string;
  rubygemsUrl: string;
  title: string;
  version: string;
  authors: string;
  info: string;
  downloads: number;
  homepageUri: string | null;
  sourceCodeUri: string | null;
  licenses: string[];
  owners: Owner[];
  notFound: boolean;
};

async function fetchGem(name: string): Promise<Gem> {
  const rubygemsUrl = `https://${RUBYGEMS_HOST}/gems/${name}`;
  const empty: Gem = {
    name,
    rubygemsUrl,
    title: name,
    version: "",
    authors: "",
    info: "",
    downloads: 0,
    homepageUri: null,
    sourceCodeUri: null,
    licenses: [],
    owners: [],
    notFound: true,
  };

  const gemRes = await fetch(
    `https://${RUBYGEMS_HOST}/api/v1/gems/${encodeURIComponent(name)}.json`,
    { headers: { accept: "application/json" } },
  );
  if (!gemRes.ok) return empty;

  const data = (await gemRes.json()) as {
    name: string;
    version: string;
    authors: string;
    info: string;
    downloads: number;
    homepage_uri: string | null;
    source_code_uri: string | null;
    licenses: string[] | null;
  };

  let owners: Owner[] = [];
  try {
    const ownerRes = await fetch(
      `https://${RUBYGEMS_HOST}/api/v1/gems/${encodeURIComponent(name)}/owners.json`,
      { headers: { accept: "application/json" } },
    );
    if (ownerRes.ok) {
      const raw = (await ownerRes.json()) as Array<{ id: number; handle: string }>;
      owners = raw.slice(0, 6).map((o) => ({ id: o.id, handle: o.handle }));
    }
  } catch {
    // owners are optional
  }

  return {
    name: data.name,
    rubygemsUrl,
    title: data.name,
    version: data.version,
    authors: data.authors ?? "",
    info: (data.info ?? "").trim(),
    downloads: data.downloads ?? 0,
    homepageUri: data.homepage_uri,
    sourceCodeUri: data.source_code_uri,
    licenses: data.licenses ?? [],
    owners,
    notFound: false,
  };
}

async function getGem(name: string, env: Env, refresh: boolean): Promise<Gem> {
  const cache = caches.default;
  const cacheKey = new Request(`https://gemcard.invalid/${env.CACHE_VERSION}/_gem/${name}`);
  if (!refresh) {
    const cached = await cache.match(cacheKey);
    if (cached) return (await cached.json()) as Gem;
  }

  const gem = await fetchGem(name);
  if (!gem.notFound) {
    await cache.put(
      cacheKey,
      new Response(JSON.stringify(gem), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "public, max-age=604800",
        },
      }),
    );
  }
  return gem;
}

async function ogpPage(
  name: string,
  origin: string,
  env: Env,
  refresh: boolean,
): Promise<Response> {
  const gem = await getGem(name, env, refresh);
  const imageUrl = gem.notFound ? null : `${origin}/img/${gem.name}.png`;
  const body = renderOgp({ gem, imageUrl });
  return new Response(body, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": gem.notFound ? "no-store" : "public, max-age=604800",
      vary: "User-Agent",
    },
  });
}

async function previewApi(name: string, env: Env, refresh: boolean): Promise<Response> {
  const gem = await getGem(name, env, refresh);
  return new Response(JSON.stringify(gem), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": gem.notFound ? "no-store" : "public, max-age=604800",
    },
  });
}

async function cardImage(name: string, env: Env, refresh: boolean): Promise<Response> {
  const gem = await getGem(name, env, refresh);
  if (gem.notFound) {
    return new Response("Not Found", { status: 404 });
  }
  return renderCard(gem);
}
