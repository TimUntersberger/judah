import { Article } from "./article.model";

export interface OrderTimelineEntry {
  date: string; // DD.MM.YYYY
  time?: string; // HH:mm
}

export interface OrderTimeline {
  unpaid?: OrderTimelineEntry;
  paid?: OrderTimelineEntry;
  sent?: OrderTimelineEntry;
  arrived?: OrderTimelineEntry;
}

export interface OrderSummary {
  articleCount: number | null;
  itemValue: number | null;
  shippingPrice: number | null;
  trusteeService?: number | null;
  totalPrice: number | null;
}

export interface OrderUser {
  username: string;
  location?: string | null;
}

export interface OrderAddress {
  name?: string;
  street?: string;
  city?: string;
  country?: string;
}

export interface Order {
  source?: string;
  orderId: string;
  type: "buy" | "sell";
  otherUser: OrderUser;
  timeline?: OrderTimeline;
  timelineAlert?: {
    status: "cancelled" | "notArrived" | null;
    message: string;
    date?: string | null;
    time?: string | null;
  } | null;
  summary: OrderSummary;
  otherUserAddress?: OrderAddress;
  userAddress?: OrderAddress;
  shipping?: {
    shippingMethod?: string;
    trackingCode?: string | null;
    refundTotals?: Record<string, number> | null;
  };
  articles: Article[];
}
