/* parse-cardmarket-order.ts
 *
 * Usage:
 *   1) npm i axios cheerio
 *   2) npx ts-node parse-cardmarket-order.ts "<URL-or-path-to-html>"
 *
 * Examples:
 *   npx ts-node parse-cardmarket-order.ts "./Purchase #1246696437 _ Cardmarket.html"
 *   CARDMARKET_COOKIE="__cf_bm=...; PHPSESSID=...; ..." npx ts-node parse-cardmarket-order.ts "https://www.cardmarket.com/en/OnePiece/Orders/1246696437"
 */

import process from "node:process";
import { CardmarketClient } from "./cardmarket/CardmarketClient";
import {
  parseOrderHtml,
  parseOrderIdsFromArrivedOrdersPage,
  parseProductPage,
} from "./parser";
import { OrderJson, ProductPage } from "./parser.types";
import fs from "node:fs/promises";
import { OrderRepository } from "./order.repository";
import { ProductRepository } from "./product.repository";

export async function searchOrderHistory(cardmarketClient: CardmarketClient, userType: string, shipmentStatus: number, start: Date, end?: Date): Promise<string[]> {
  const orderIds: string[] = [];

  const serializeDate = (date: Date) => date.getFullYear() + "-" + ("" + (date.getMonth()+1)).padStart(2, "0") + "-" + ("" + date.getDate()).padStart(2, "0");

  if (end && end.getTime() > start.getTime()) {
    throw new Error("End date must be before or equal to start date");
  }

  while (true) {
    const maxBack = new Date(start.getTime() - 1000 * 60 * 60 * 24 * 30); // start date - 30 days | max is 60 day diff so lower to make sure we don't hit it
    const minDate = end && maxBack < end ? end : maxBack;
    console.log(`Fetching from ${serializeDate(start)} -> ${serializeDate(minDate)}`);

    const resultOrders = [];
    let page = 1;

    while(true) {
      console.log(`Fetching page ${page}`);
      const url = `https://www.cardmarket.com/en/OnePiece/Orders/Search/Results?userType=${userType}&minDate=${serializeDate(minDate)}&maxDate=${serializeDate(start)}&shipmentStatus=${shipmentStatus}&site=${page}`
      console.log(url);
      await delayRandom(4000);
      await cardmarketClient.gotoUrl(url);
      const html = await cardmarketClient.getPage().content();
      const orders = parseOrderIdsFromArrivedOrdersPage(html, url);
      if (orders.length == 0)
        break;

      resultOrders.push(...orders);
      page++;
    }

    console.log(`Got additional ${resultOrders.length} orders. Total orders: ${orderIds.length + resultOrders.length}`);
    if (resultOrders.length == 0) {
      break;
    }

    orderIds.push(...resultOrders);
    if (end && minDate.getTime() <= end.getTime()) {
      break;
    }
    start = new Date(minDate.getTime() + 1000 * 60 * 60 * 24 * 15); // + 15 days to bandaid fix search bug that cardmarket has
  }
  const distinctOrders = Array.from(new Set(orderIds));
  console.log(`Total unique order id amount: ${distinctOrders.length}`);
  return distinctOrders;
}

export async function fetchPurchaseHistory(cardmarketClient: CardmarketClient, start: Date, end?: Date): Promise<string[]> {
  return searchOrderHistory(cardmarketClient, "buyer", 200, start, end);
}

export async function fetchSellHistory(cardmarketClient: CardmarketClient, start: Date, end?: Date): Promise<string[]> {
  return searchOrderHistory(cardmarketClient, "seller", 200, start, end);
}

export async function fetchOrderDetails(cardmarketClient: CardmarketClient, orderId: string): Promise<OrderJson> {
  console.log("Fetching order ID:", orderId);
  const url = `https://www.cardmarket.com/en/OnePiece/Orders/${orderId}`;
  await cardmarketClient.gotoUrl(url);
  const html = await cardmarketClient.getPage().content();
  const orderData = parseOrderHtml(html, url);
  return orderData;
}

export async function importOrderIds(
  cardmarketClient: CardmarketClient,
  orderRepo: OrderRepository,
  productRepo: ProductRepository,
  ids: string[],
) {
  for (const orderId of ids) {
    if(orderRepo.has(orderId)) {
      console.log("Order with id " + orderId + " already loaded. Skipping...");
      continue;
    }
    await delayRandom(3000);
    const order = await fetchOrderDetails(cardmarketClient, orderId);
    orderRepo.add(orderId, order);
    productRepo.ensurePlaceholdersForArticles(order.articles ?? []);
    console.log("Fetched order:", orderId);
  }

  await orderRepo.save();
}

export async function importOrdersFromFile(
  cardmarketClient: CardmarketClient,
  orderRepo: OrderRepository,
  productRepo: ProductRepository,
  path: string,
) {
  return importOrderIds(
    cardmarketClient,
    orderRepo,
    productRepo,
    JSON.parse(await fs.readFile(path, { encoding: "utf-8" })),
  );
}

export async function fetchProductInfoFromUrl(cardmarketClient: CardmarketClient, url: string): Promise<ProductPage> {
  const html = await cardmarketClient.fetchHtml(url);
  const productPage = parseProductPage(html, url);
  return productPage;
}

export async function initCardmarketClient(username: string, password: string): Promise<CardmarketClient> {
  const cardmarketClient = new CardmarketClient({
    homeUrl: "https://www.cardmarket.com/en/OnePiece",
    loginUrl: "https://www.cardmarket.com/en/OnePiece/Login",
    username: process.env.CARDMARKET_USERNAME! || "xbaaka",
    password: process.env.CARDMARKET_PASSWORD! || "Teamtengu1!",
    storageStatePath: "cardmarket-storage-state.json",
    headless: false
  });

  await cardmarketClient.init();

  return cardmarketClient;
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function delayRandom(magnitudeMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * magnitudeMs);
  console.log("Delaying for", ms, "ms");
  return delay(ms);
}

export { OrderRepository, ProductRepository };
