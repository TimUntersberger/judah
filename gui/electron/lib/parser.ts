import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import type {
  AddressBlock,
  ArticleItem,
  OrderJson,
  ProductInfoList,
  ProductOffer,
  ProductPage,
  ProductPriceAverages,
  ProductSellerInfo,
  RefundTotals,
  TimelineAlert,
} from "./parser.types";

function textOrNull(s: string | undefined | null): string | null {
  const t = (s ?? "").trim();
  return t.length ? t : null;
}

function parseEuroNumber(text?: string | null): number | null {
  if (!text) return null;
  const cleaned = text
    .replace(/\s/g, "")
    .replace(/€/g, "")
    .replace(/\./g, "") // thousands separators
    .replace(",", "."); // decimal comma -> dot
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Requirement: "Instead of copying the text of name column take the href and
 * use the last path item as the name".
 *
 * Example:
 *   /en/OnePiece/Products/Singles/OP01-Romance-Dawn/Monkey-D-Luffy
 * -> "Monkey D Luffy"
 */
function nameFromHrefLastPath(href?: string | null): string | null {
  if (!href) return null;

  let pathname = href;
  try {
    const u = new URL(href, "https://www.cardmarket.com");
    pathname = u.pathname;
  } catch {
    // ignore; use raw href
  }

  const parts = pathname.split("/").filter(Boolean);
  const last = parts[parts.length - 1];
  if (!last) return null;

  return last.replace(/-/g, " ");
}

function extractAddress($: cheerio.CheerioAPI, rootSelector: string): AddressBlock | null {
  const root = $(rootSelector);
  if (!root.length) return null;

  const pick = (cls: string) => textOrNull(root.find(cls).first().text());

  const addr: AddressBlock = {
    name: pick(".Name"),
    extra: pick(".Extra"),
    street: pick(".Street"),
    city: pick(".City"),
    country: pick(".Country"),
  };

  if (!addr.name && !addr.extra && !addr.street && !addr.city && !addr.country) return null;
  return addr;
}

function extractOrderId($: cheerio.CheerioAPI): string | null {
  const h1 = $("h1").first().text().trim();
  const m = h1.match(/#(\d+)/);
  return m ? m[1] || null : null;
}

function extractSeller($: cheerio.CheerioAPI): OrderJson["otherUser"] {
  const sellerLink = $('#SellerBuyerInfo a[href*="/Users/"]').first();
  const username = textOrNull(sellerLink.text());

  const itemLocTitle = $('#SellerBuyerInfo [title^="Item location:"]').first().attr("title") || null;
  const itemLocation = itemLocTitle ? itemLocTitle.replace("Item location:", "").trim() : null;

  return { username, location: itemLocation };
}

function extractTimeline($: cheerio.CheerioAPI): OrderJson["timeline"] {
  const out: OrderJson["timeline"] = {};
  $("#Timeline .timeline-box").each((_, box) => {
    const label = $(box).find("div").first().text().replace(/\u00a0/g, " ").trim(); // "Paid:" etc
    const spans = $(box).find("div").eq(1).find("span");

    const date = textOrNull($(spans.get(0)).text());
    const time = textOrNull($(spans.get(1)).text());

    const key = label.replace(":", "").toLowerCase();
    if (key) out[key] = { date, time };
  });
  return out;
}

function extractTimelineAlert($: cheerio.CheerioAPI): TimelineAlert | null {
  let alert = $("#Timeline").children("div[role='alert']").first();
  if (!alert.length) return null;
  const text = textOrNull(alert.text());
  if (!text) return null;

  const match = text.match(/(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2}:\d{2})$/);
  let message = text;
  let date: string | null = null;
  let time: string | null = null;
  if (match) {
    message = text.substring(0, match.index ?? 0).trim();
    date = match[1];
    time = match[2];
  }
  const status = determineAlertStatus(message);
  return { status, message, date: date || null, time: time || null };
}

function determineAlertStatus(message: string): TimelineAlert["status"] {
  const normalized = message.toLowerCase();
  if (normalized.includes("cancelled") || normalized.includes("canceled")) {
    return "cancelled";
  }
  if (normalized.includes("not arrived")) {
    return "notArrived";
  }
  return null;
}

function extractRefundTotals($: cheerio.CheerioAPI): RefundTotals | null {
  const totals: RefundTotals = {};
  let hasRefund = false;

  $("#collapsibleShipmentHistory .row").each((_, element) => {
    const row = $(element);
    const rowText = row.text().toLowerCase();
    if (!rowText.includes("refund")) return;

    const seller = textOrNull(row.find("a").first().text());
    if (!seller) return;

    const note = textOrNull(row.find(".col").last().text()) ?? "";
    const amountMatch = note.match(/refund\s*([\d\.,]+)\s*€/i);
    const amount = amountMatch ? parseEuroNumber(amountMatch[1]) : null;
    if (amount === null) return;

    totals[seller] = (totals[seller] ?? 0) + amount;
    hasRefund = true;
  });

  return hasRefund ? totals : null;
}

function extractSummary($: cheerio.CheerioAPI): OrderJson["summary"] | null {
  const s = $(".summary").first();
  if (!s.length) return null;

  const articleCountRaw = Number(s.attr("data-article-count") ?? "");
  const itemValueRaw = Number(s.attr("data-item-value") ?? "");
  const shippingPriceRaw = Number(s.attr("data-shipping-price") ?? "");
  const trusteeServiceRaw = Number(s.attr("data-internal-insurance") ?? "");
  const totalPriceRaw = Number(s.attr("data-total-price") ?? "");

  // fallback formatted values
  const formatted = {
    itemValue: parseEuroNumber(s.find(".item-value").first().text()),
    shippingPrice: parseEuroNumber(s.find(".shipping-price").first().text()),
    trusteeService: parseEuroNumber(s.find(".service-cost").first().text()),
    totalPrice: parseEuroNumber(s.find(".strong.total").first().text()),
  };

  return {
    articleCount: Number.isFinite(articleCountRaw) ? articleCountRaw : null,
    itemValue: Number.isFinite(itemValueRaw) ? itemValueRaw : formatted.itemValue,
    shippingPrice: Number.isFinite(shippingPriceRaw) ? shippingPriceRaw : formatted.shippingPrice,
    trusteeService: Number.isFinite(trusteeServiceRaw) ? trusteeServiceRaw : formatted.trusteeService,
    totalPrice: Number.isFinite(totalPriceRaw) ? totalPriceRaw : formatted.totalPrice,
  };
}

function extractShipping($: cheerio.CheerioAPI): OrderJson["shipping"] | null {
  const container = $("#collapsibleOtherInfo");
  if (!container.length) return null;

  let shippingMethod: string | null = null;
  let trackingCode: string | null = null;

  container.find("dt").each((_, dt) => {
    const label = $(dt).text().trim().toLowerCase();
    const dd = $(dt).next("dd");
    if (!dd.length) return;

    if (label.startsWith("shipping method")) {
      shippingMethod =
        textOrNull(dd.find("> span").first().text()) ??
        textOrNull(dd.text());
    }

    if (label.startsWith("tracking code")) {
      trackingCode =
        textOrNull(dd.find("a").first().text()) ??
        textOrNull(dd.text());
    }
  });

  const refundTotals = extractRefundTotals($);

  if (!shippingMethod && !trackingCode && !refundTotals) return null;
  return {
    shippingMethod,
    trackingCode,
    refundTotals,
  };
}

function extractArticles($: cheerio.CheerioAPI): ArticleItem[] {
  const items: ArticleItem[] = [];

  $("table.product-table tbody tr").each((_, tr) => {
    const $tr = $(tr);

    // Name from href last path segment (per your request)
    const href = $tr.find("a[href]").first().attr("href") ?? null;
    const name = nameFromHrefLastPath(href);

    const amountRaw = Number($tr.attr("data-amount") ?? "");
    const amount = Number.isFinite(amountRaw) ? amountRaw : null;

    const expansionName = $tr.attr("data-expansion-name") ?? null;
    const collectorNumber = $tr.attr("data-number") ?? null;

    const priceEachRaw = Number($tr.attr("data-price") ?? "");
    const priceEach = Number.isFinite(priceEachRaw) ? priceEachRaw : null;

    const commentRaw = $tr.attr("data-comment") ?? null;
    const comment = commentRaw?.trim() ? commentRaw.trim() : null;

    const condition = textOrNull($tr.find(".article-condition .badge").first().text());

    // Best-effort; Cardmarket often uses title tooltips for language
    const language = $tr.find("[title]").first().attr("title")?.trim() ?? null;

    // Visible row total often in last "td.price"
    const rowTotalDisplayed = parseEuroNumber($tr.find("td.price").last().text());

    // Skip garbage rows
    if (!name) return;

    items.push({
      name,
      amount,
      expansionName,
      link: href,
      collectorNumber,
      condition,
      language,
      priceEach,
      rowTotalDisplayed,
      comment,
    });
  });

    return items;
}

function parseInteger(text?: string | null): number | null {
  if (!text) return null;
  const match = text.match(/-?\d+/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseSellerLocation(title?: string | null | undefined): string | null {
  if (!title) return null;
  const match = title.match(/Item location:\s*(.+)/i);
  if (match) {
    return match[1]?.trim() ?? null;
  }
  return title.trim() || null;
}

function parseSalesBadge(
  title?: string | null | undefined
): {
  salesCount: number | null;
  availableItems: number | null;
} {
  if (!title) {
    return { salesCount: null, availableItems: null };
  }
  const numbers = title.match(/\d+/g) ?? [];
  const salesCount = numbers[0] ? Number(numbers[0]) : null;
  const availableItems = numbers[1] ? Number(numbers[1]) : null;
  return { salesCount, availableItems };
}

function parseDeliveryDays(text?: string | null): number | null {
  if (!text) return null;
  const match = text.match(/\d+/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractArticleId(row: cheerio.Cheerio<Element>): string | null {
  const idAttr = row.attr("id");
  const match = idAttr?.match(/articleRow(\d+)/);
  return match?.[1] ?? null;
}

function extractSellerInfo(row: cheerio.Cheerio<Element>): ProductSellerInfo {
  const anchor = row.find(".seller-name a").first();
  const { salesCount, availableItems } = parseSalesBadge(row.find(".sell-count").attr("title"));
  const rating = row
    .find(".seller-extended span[class*='fonticon-seller-rating']")
    .first()
    .attr("title");
  return {
    username: textOrNull(anchor.text()),
    profileUrl: anchor.attr("href") ?? null,
    location: parseSellerLocation(row.find(".seller-name span[title^='Item location']").attr("title")),
    rating: textOrNull(rating),
    salesCount,
    availableItems,
    estimatedDeliveryDays: parseDeliveryDays(row.find(".shippingTime-info").text()),
    professional: row.find(".seller-name .fonticon-users-professional").length > 0,
  };
}

function extractProductOffers($: cheerio.CheerioAPI): ProductOffer[] {
  const offers: ProductOffer[] = [];
  $(".article-row").each((_, element) => {
    const row = $(element);
    const priceText = row.find(".col-offer .price-container .color-primary").first().text();
    const amountText = row.find(".col-offer .amount-container span.item-count").first().text();
    const conditionTitle = row.find(".article-condition").attr("title");
    const condition =
      textOrNull(conditionTitle) ??
      textOrNull(row.find(".article-condition .badge").first().text());
    const language = textOrNull(
      row.find(".product-attributes span.icon[title]").first().attr("title")
    );
    const comment = textOrNull(row.find(".product-comments .d-block").first().text());

    offers.push({
      articleId: extractArticleId(row),
      priceEach: parseEuroNumber(priceText),
      stock: parseInteger(amountText),
      condition,
      language,
      comment,
      seller: extractSellerInfo(row),
    });
  });
  return offers;
}

function extractInfoList($: cheerio.CheerioAPI): ProductInfoList {
  const info: ProductInfoList = {};
  const dtElements = $("#tabContent-info dl.labeled dt").toArray();
  const ddElements = $("#tabContent-info dl.labeled dd").toArray();

  for (let i = 0; i < Math.min(dtElements.length, ddElements.length); i++) {
    const key = textOrNull($(dtElements[i]).text());
    if (!key) continue;
    const value = textOrNull($(ddElements[i]).text());
    info[key] = value;
  }

  return info;
}

function extractPriceAverages(info: ProductInfoList): ProductPriceAverages {
  return {
    average1Day: parseEuroNumber(info["1-day average price"]),
    average7Day: parseEuroNumber(info["7-days average price"]),
    average30Day: parseEuroNumber(info["30-days average price"]),
  };
}

export function parseProductPage(html: string, sourceUrl: string): ProductPage {
  const $ = cheerio.load(html);
  const productName = textOrNull($("h1").first().text());
  const productId = textOrNull($("input[name='idProduct']").attr("value"));
  const infoList = extractInfoList($);
  const priceAverages = extractPriceAverages(infoList);

  return {
    source: sourceUrl,
    productName,
    productId,
    offers: extractProductOffers($),
    infoList,
    priceAverages,
  };
}

/**
 * Parse the full order page HTML (fetched via Playwright) into a structured JSON object.
 */
export function parseOrderHtml(html: string, sourceUrl: string): OrderJson {
  const $ = cheerio.load(html);
  const otherUserAddress = extractAddress($, "#collapsibleSellerAddress .text-break");
  const userAddress = extractAddress($, "#ShippingAddress");
  const type: OrderJson["type"] = otherUserAddress ? "buy" : "sell";

  return {
    source: sourceUrl,
    orderId: extractOrderId($),
    type,
    otherUser: extractSeller($),
    timeline: extractTimeline($),
    timelineAlert: extractTimelineAlert($),
    summary: extractSummary($),
    otherUserAddress,
    userAddress,
    shipping: extractShipping($),
    articles: extractArticles($),
  };
}

export function parseOrderIdsFromArrivedOrdersPage(html: string, sourceUrl: string): string[] {
  const $ = cheerio.load(html);
  const orderIds: string[] = [];
  $("#StatusTable > .table-body > div").each((_, row) => {
    const $row = $(row);
    const orderId = $row.children("div:nth-child(2)")?.text().trim() || null;
    if (orderId) {
      orderIds.push(orderId);
    }
  });
  return orderIds;
}
