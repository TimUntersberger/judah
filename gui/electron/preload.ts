import { contextBridge, ipcRenderer } from "electron";
import type { OrderJson, ProductPage } from "./lib/parser.types";

export type OrderImportPayload = {
  startDate: string;
  endDate?: string;
  userType?: "buyer" | "seller";
  shipmentStatus?: number;
};

export type OrderImportResponse = {
  scanned: number;
};

contextBridge.exposeInMainWorld("api", {
  orders: {
    list: (): Promise<Record<string, OrderJson>> =>
      ipcRenderer.invoke("orders:list"),
    importRange: (payload: OrderImportPayload): Promise<OrderImportResponse> =>
      ipcRenderer.invoke("orders:import-range", payload),
  },
    products: {
      list: (): Promise<ProductPage[]> => ipcRenderer.invoke("products:list"),
      fetch: (url: string): Promise<ProductPage> =>
        ipcRenderer.invoke("products:fetch", { url }),
      setFavorite: (productId: string, favorite: boolean): Promise<{ success: boolean }> =>
        ipcRenderer.invoke("products:set-favorite", { productId, favorite }),
      open: (url: string): Promise<void> => ipcRenderer.invoke("products:open", { url }),
    },
  });

export type Api = {
  orders: {
    list: () => Promise<Record<string, OrderJson>>;
    importRange: (payload: OrderImportPayload) => Promise<OrderImportResponse>;
  };
  products: {
    list: () => Promise<ProductPage[]>;
    fetch: (url: string) => Promise<ProductPage>;
    setFavorite: (productId: string, favorite: boolean) => Promise<{ success: boolean }>;
    open: (url: string) => Promise<void>;
  };
};
