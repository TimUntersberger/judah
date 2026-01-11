export function formatMoney(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

export function totalPieces(articles: { amount?: number }[] | undefined): number {
  if (!articles) return 0;
  return articles.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
}

export function articleLineTotal(article: {
  amount?: number;
  priceEach?: number;
}): number | null {
  const qty = Number(article.amount);
  const each = Number(article.priceEach);
  if (!Number.isFinite(qty) || !Number.isFinite(each)) return null;
  return qty * each;
}
