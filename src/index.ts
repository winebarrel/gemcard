import indexHtml from "./index.html";
import { renderCard } from "./render-card";
import { renderOgp } from "./render-ogp";

const RUBYGEMS_HOST = "rubygems.org";
const NAME_RE = "[a-zA-Z0-9_.-]+?";
const VERSION_RE = "[a-zA-Z0-9._-]+?";

interface Env {
  CACHE_VERSION: string;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const refresh = url.searchParams.get("refresh") === "1";

    const gem = url.pathname.match(
      new RegExp(`^/gems/(${NAME_RE})(?:/versions/(${VERSION_RE}))?/?$`),
    );
    if (gem) {
      const name = gem[1];
      const version = gem[2] ?? null;
      const ua = req.headers.get("user-agent") ?? "";
      if (!isCrawler(ua)) {
        return Response.redirect(rubygemsUrl(name, version), 302);
      }
      return ogpPage(name, version, url.origin, env, refresh);
    }

    const imgVer = url.pathname.match(
      new RegExp(`^/img/(${NAME_RE})/versions/(${VERSION_RE})\\.png/?$`),
    );
    if (imgVer) {
      return cardImage(imgVer[1], imgVer[2], env, refresh);
    }
    const img = url.pathname.match(new RegExp(`^/img/(${NAME_RE})\\.png/?$`));
    if (img) {
      return cardImage(img[1], null, env, refresh);
    }

    const api = url.pathname.match(
      new RegExp(`^/api/preview/(${NAME_RE})(?:/versions/(${VERSION_RE}))?/?$`),
    );
    if (api) {
      return previewApi(api[1], api[2] ?? null, env, refresh);
    }

    if (url.pathname === "/" || url.pathname === "") {
      const input = url.searchParams.get("url");
      if (input) {
        const parsed = parseGemInput(input);
        if (parsed) {
          const path = parsed.version
            ? `/gems/${parsed.name}/versions/${parsed.version}`
            : `/gems/${parsed.name}`;
          return Response.redirect(`${url.origin}${path}`, 302);
        }
      }
      return new Response(indexHtml, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

function parseGemInput(input: string): { name: string; version: string | null } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withVersion = trimmed.match(
    /rubygems\.org\/gems\/([a-zA-Z0-9_.-]+)\/versions\/([a-zA-Z0-9._-]+)/i,
  );
  if (withVersion) return { name: withVersion[1], version: withVersion[2] };
  const m = trimmed.match(/rubygems\.org\/gems\/([a-zA-Z0-9_.-]+)/i);
  if (m) return { name: m[1], version: null };
  if (/^[a-zA-Z0-9_.-]+$/.test(trimmed)) return { name: trimmed, version: null };
  return null;
}

function rubygemsUrl(name: string, version: string | null): string {
  return version
    ? `https://${RUBYGEMS_HOST}/gems/${name}/versions/${version}`
    : `https://${RUBYGEMS_HOST}/gems/${name}`;
}

function isCrawler(ua: string): boolean {
  return /bot|crawler|spider|facebookexternalhit|slackbot|linkedinbot|whatsapp|telegrambot|pinterest|embedly|developers\.google\.com\/\+\/web\/snippet/i.test(
    ua,
  );
}

export type Gem = {
  name: string;
  rubygemsUrl: string;
  title: string;
  version: string;
  authors: string;
  info: string;
  downloads: number;
  versionDownloads: number | null;
  versionCreatedAt: string | null;
  homepageUri: string | null;
  sourceCodeUri: string | null;
  licenses: string[];
  isSpecificVersion: boolean;
  notFound: boolean;
};

async function fetchGem(name: string, version: string | null): Promise<Gem> {
  const url = rubygemsUrl(name, version);
  const empty: Gem = {
    name,
    rubygemsUrl: url,
    title: name,
    version: version ?? "",
    authors: "",
    info: "",
    downloads: 0,
    versionDownloads: null,
    versionCreatedAt: null,
    homepageUri: null,
    sourceCodeUri: null,
    licenses: [],
    isSpecificVersion: version !== null,
    notFound: true,
  };

  const endpoint = version
    ? `https://${RUBYGEMS_HOST}/api/v2/rubygems/${encodeURIComponent(name)}/versions/${encodeURIComponent(version)}.json`
    : `https://${RUBYGEMS_HOST}/api/v1/gems/${encodeURIComponent(name)}.json`;

  const gemRes = await fetch(endpoint, { headers: { accept: "application/json" } });
  if (!gemRes.ok) return empty;

  const data = (await gemRes.json()) as {
    name: string;
    version: string;
    version_created_at?: string;
    version_downloads?: number;
    authors: string;
    info: string;
    downloads: number;
    homepage_uri: string | null;
    source_code_uri: string | null;
    licenses: string[] | null;
  };

  return {
    name: data.name,
    rubygemsUrl: url,
    title: data.name,
    version: data.version,
    authors: data.authors ?? "",
    info: (data.info ?? "").trim(),
    downloads: data.downloads ?? 0,
    versionDownloads: data.version_downloads ?? null,
    versionCreatedAt: data.version_created_at ?? null,
    homepageUri: data.homepage_uri,
    sourceCodeUri: data.source_code_uri,
    licenses: data.licenses ?? [],
    isSpecificVersion: version !== null,
    notFound: false,
  };
}

async function getGem(
  name: string,
  version: string | null,
  env: Env,
  refresh: boolean,
): Promise<Gem> {
  const cache = caches.default;
  const cacheSlug = version ? `${name}@${version}` : name;
  const cacheKey = new Request(`https://gemcard.invalid/${env.CACHE_VERSION}/_gem/${cacheSlug}`);
  if (!refresh) {
    const cached = await cache.match(cacheKey);
    if (cached) return (await cached.json()) as Gem;
  }

  const gem = await fetchGem(name, version);
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

function imgUrl(origin: string, name: string, version: string | null): string {
  return version ? `${origin}/img/${name}/versions/${version}.png` : `${origin}/img/${name}.png`;
}

async function ogpPage(
  name: string,
  version: string | null,
  origin: string,
  env: Env,
  refresh: boolean,
): Promise<Response> {
  const gem = await getGem(name, version, env, refresh);
  const imageUrl = gem.notFound ? null : imgUrl(origin, gem.name, version);
  const body = renderOgp({ gem, imageUrl });
  return new Response(body, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": gem.notFound ? "no-store" : "public, max-age=604800",
      vary: "User-Agent",
    },
  });
}

async function previewApi(
  name: string,
  version: string | null,
  env: Env,
  refresh: boolean,
): Promise<Response> {
  const gem = await getGem(name, version, env, refresh);
  return new Response(JSON.stringify(gem), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": gem.notFound ? "no-store" : "public, max-age=604800",
    },
  });
}

async function cardImage(
  name: string,
  version: string | null,
  env: Env,
  refresh: boolean,
): Promise<Response> {
  const gem = await getGem(name, version, env, refresh);
  if (gem.notFound) {
    return new Response("Not Found", { status: 404 });
  }
  return renderCard(gem);
}
