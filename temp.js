#!/usr/bin/env node
/**
 * Migrate Cardmarket order JSON from old structure to new TS structure.
 *
 * Usage:
 *   node migrate-orders.js input.json output.json
 *
 * If output.json is omitted, it will write:
 *   <input basename>.migrated.json
 */

const fs = require("fs");
const path = require("path");

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function toNullableString(v) {
  return v === undefined ? null : v === null ? null : String(v);
}

function toNullableNumber(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapTimeline(timeline) {
  const out = {};
  if (!isPlainObject(timeline)) return out;

  for (const [k, entry] of Object.entries(timeline)) {
    const e = isPlainObject(entry) ? entry : {};
    out[k] = {
      date: e.date ?? null,
      time: e.time ?? null,
    };
  }
  return out;
}

function mapSummary(summary) {
  if (summary == null) return null;
  if (!isPlainObject(summary)) return null;

  return {
    articleCount: summary.articleCount ?? null,
    itemValue: toNullableNumber(summary.itemValue),
    shippingPrice: toNullableNumber(summary.shippingPrice),
    trusteeService: toNullableNumber(summary.trusteeService),
    totalPrice: toNullableNumber(summary.totalPrice),
  };
}

function mapAddress(addr) {
  if (addr == null) return null;
  if (!isPlainObject(addr)) return null;

  return {
    name: addr.name ?? null,
    extra: addr.extra ?? null,
    street: addr.street ?? null,
    city: addr.city ?? null,
    country: addr.country ?? null,
  };
}

function mapShipping(shipping) {
  if (shipping == null) return null;
  if (!isPlainObject(shipping)) return null;

  return {
    shippingMethod: shipping.shippingMethod ?? null,
    trackingCode: shipping.trackingCode ?? null,
  };
}

function mapArticles(articles) {
  if (!Array.isArray(articles)) return [];

  return articles.map((a) => {
    const art = isPlainObject(a) ? a : {};
    return {
      name: art.name ?? null, // keep as-is
      amount: art.amount ?? null,
      expansionName: art.expansionName ?? null,
      collectorNumber: art.collectorNumber ?? null,
      condition: art.condition ?? null,
      language: art.language ?? null,
      priceEach: toNullableNumber(art.priceEach),
      rowTotalDisplayed: toNullableNumber(art.rowTotalDisplayed),
      comment: art.comment ?? null,
    };
  });
}

function migrateOneOrder(oldOrder) {
  if (!isPlainObject(oldOrder)) {
    throw new Error("Order is not an object");
  }

  const shippingAddress = oldOrder.shippingAddress ?? null;

  const type = shippingAddress === null ? "sell" : "buy";

  const seller = isPlainObject(oldOrder.seller) ? oldOrder.seller : {};

  // IMPORTANT: user requested we do NOT include "cancelled" at all.
  return {
    source: String(oldOrder.source ?? ""),
    orderId: oldOrder.orderId ?? null,
    type,

    otherUser: {
      username: seller.username ?? null,
      location: seller.itemLocation ?? null,
    },

    timeline: mapTimeline(oldOrder.timeline),
    summary: mapSummary(oldOrder.summary),

    otherUserAddress: mapAddress(oldOrder.sellerAddress),
    userAddress: mapAddress(oldOrder.shippingAddress),

    shipping: mapShipping(oldOrder.shipping),
    articles: mapArticles(oldOrder.articles),
  };
}

function migrateFile(inputPath, outputPath) {
  const raw = fs.readFileSync(inputPath, "utf8");
  const data = JSON.parse(raw);

  let migrated;

  // Primary expected shape: { [id]: order }
  if (isPlainObject(data)) {
    // Heuristic: if it looks like a single order (has "source" and "orderId"), migrate directly
    const looksLikeSingleOrder = "source" in data && "orderId" in data && "articles" in data;

    if (looksLikeSingleOrder) {
      migrated = migrateOneOrder(data);
    } else {
      migrated = {};
      for (const [id, order] of Object.entries(data)) {
        migrated[id] = migrateOneOrder(order);
      }
    }
  } else {
    throw new Error("Input JSON must be an object (either id->order map or a single order object).");
  }

  fs.writeFileSync(outputPath, JSON.stringify(migrated, null, 2), "utf8");
}

function main() {
  const [, , inputArg, outputArg] = process.argv;

  if (!inputArg) {
    console.error("Usage: node migrate-orders.js <input.json> [output.json]");
    process.exit(1);
  }

  const inputPath = path.resolve(process.cwd(), inputArg);
  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const outputPath = outputArg
    ? path.resolve(process.cwd(), outputArg)
    : path.join(
        path.dirname(inputPath),
        `${path.basename(inputPath, path.extname(inputPath))}.migrated.json`
      );

  try {
    migrateFile(inputPath, outputPath);
    console.log(`✅ Migrated orders written to: ${outputPath}`);
  } catch (err) {
    console.error("❌ Migration failed:", err && err.message ? err.message : err);
    process.exit(1);
  }
}

main();
