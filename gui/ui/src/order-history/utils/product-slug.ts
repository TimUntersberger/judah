export function extractProductSlug(link?: string | null): string | null {
  if (!link) return null;
  try {
    const url = new URL(link, "https://www.cardmarket.com");
    const path = url.pathname;
    const marker = "/products/";
    const idx = path.toLowerCase().indexOf(marker);
    if (idx === -1) return null;
    const slug = path.substring(idx + marker.length).replace(/^\/+|\/+$/g, "");
    return slug.length ? slug : null;
  } catch {
    return null;
  }
}
