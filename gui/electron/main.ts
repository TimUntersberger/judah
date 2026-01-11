import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "path";
import fs from "fs/promises";
import {
  fetchProductInfoFromUrl,
  initCardmarketClient,
  importOrderIds,
  searchOrderHistory,
  OrderRepository,
  ProductRepository,
} from "./lib";
import type { CardmarketClient } from "./lib/cardmarket/CardmarketClient";

const isDev = !app.isPackaged;
let cardmarketClient: CardmarketClient | null = null;

const DATA_DIR = path.join(process.cwd(), "data");
const ORDER_DB_PATH = path.join(DATA_DIR, "orders.db");
const PRODUCT_DB_PATH = path.join(DATA_DIR, "products.db");

let orderRepo: OrderRepository | null = null;
let productRepo: ProductRepository | null = null;

type OrderImportPayload = {
  startDate: string;
  endDate?: string;
  userType?: "buyer" | "seller";
  shipmentStatus?: number;
};

type ProductFetchPayload = { url: string };

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // IMPORTANT security defaults:
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (isDev) {
    win.loadURL("http://localhost:4200");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    // Angular build output will be copied/pointed here later
    win.loadFile(path.join(__dirname, "..", "ui-dist", "index.html"));
  }
}

async function bootCardmarketClient(): Promise<void> {
  const username = process.env.CARDMARKET_USERNAME!;
  const password = process.env.CARDMARKET_PASSWORD!;

  try {
    cardmarketClient = await initCardmarketClient(username, password);
  } catch (err) {
    console.error("Failed to initialize Cardmarket client", err);
  }
}

async function ensureDataDirectory(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function getOrderRepository(): OrderRepository {
  if (!orderRepo) {
    throw new Error("Order repository not ready");
  }
  return orderRepo;
}

function getProductRepository(): ProductRepository {
  if (!productRepo) {
    throw new Error("Product repository not ready");
  }
  return productRepo;
}

async function ensureCardmarketClient(): Promise<CardmarketClient> {
  const client = await getBootedClient();
  await client.ensureLoggedIn();
  return client;
}

async function getBootedClient(): Promise<CardmarketClient> {
  if (!cardmarketClient) {
    await bootCardmarketClient();
  }
  if (!cardmarketClient) {
    throw new Error("Cardmarket client unavailable");
  }
  return cardmarketClient;
}

app.whenReady().then(async () => {
  if (isDev) {
    // Auto reload in dev (optional)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require("electron-reload")(__dirname, {
      electron: require(`${process.cwd()}/node_modules/electron`),
    });
  }

  await ensureDataDirectory();
  orderRepo = new OrderRepository(ORDER_DB_PATH);
  productRepo = new ProductRepository(PRODUCT_DB_PATH);

  ipcMain.handle("orders:list", () => {
    return getOrderRepository().getAll();
  });

  ipcMain.handle("orders:import-range", async (_, payload: OrderImportPayload) => {
    const client = await ensureCardmarketClient();
    const repository = getOrderRepository();
    const start = new Date(payload.startDate);
    const end = payload.endDate ? new Date(payload.endDate) : undefined;
    const ids = await searchOrderHistory(
      client,
      payload.userType ?? "buyer",
      payload.shipmentStatus ?? 200,
      start,
      end,
    );
    await importOrderIds(client, repository, getProductRepository(), ids);
    return {
      scanned: ids.length,
    };
  });

  ipcMain.handle("products:list", () => {
    return getProductRepository().getAll();
  });

  ipcMain.handle(
    "products:set-favorite",
    async (_, payload: { productId: string; favorite: boolean }) => {
      const repo = getProductRepository();
      repo.setFavorite(payload.productId, payload.favorite);
      return { success: true };
    },
  );

  ipcMain.handle("products:fetch", async (_, payload: ProductFetchPayload) => {
    const client = await ensureCardmarketClient();
    const productPage = await fetchProductInfoFromUrl(client, payload.url);
    getProductRepository().add(productPage);
    return productPage;
  });

  ipcMain.handle("products:open", (_, payload: { url: string }) => {
    shell.openExternal(payload.url);
  });

  createWindow();
  await bootCardmarketClient();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", async () => {
  orderRepo?.close();
  productRepo?.close();
  await cardmarketClient?.close();
});
