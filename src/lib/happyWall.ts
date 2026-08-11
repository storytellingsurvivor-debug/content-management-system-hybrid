// happy-milo-core already exposes a public, slug-based read API
// (GET /{locale}/happy-wall/api/{slug}) that returns a wall's numeric id.
// We use that instead of asking admins to look up and type a numeric
// happy_wall_id by hand — they just paste the wall's normal page URL.

interface ParsedWallUrl {
  origin: string;
  locale: string;
  slug: string;
}

export function parseWallUrl(wallUrl: string): ParsedWallUrl {
  const url = new URL(wallUrl);
  const parts = url.pathname.split("/").filter(Boolean);
  // Expected shape: /{locale}/happy-wall/{slug}
  const locale = parts[0] ?? "en";
  const slug = parts[parts.length - 1] ?? "";
  if (!slug) {
    throw new Error("Could not find a wall slug in that URL.");
  }
  return { origin: url.origin, locale, slug };
}

export async function resolveHappyWallId(wallUrl: string): Promise<number> {
  const { origin, locale, slug } = parseWallUrl(wallUrl);
  const res = await fetch(`${origin}/${locale}/happy-wall/api/${slug}`);
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(
      data.error ?? `Could not resolve a happy wall id from ${wallUrl}.`,
    );
  }
  const id = Number(data.data?.id);
  if (!Number.isInteger(id)) {
    throw new Error(`Unexpected response resolving wall id from ${wallUrl}.`);
  }
  return id;
}
