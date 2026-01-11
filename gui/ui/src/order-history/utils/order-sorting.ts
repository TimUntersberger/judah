import { Order } from "../models/order.model";
import { latestEventDate } from "./order-dates";
import { totalPieces } from "./order-format";

export type SortKey =
  | "eventDate"
  | "totalPrice"
  | "itemValue"
  | "shippingPrice"
  | "articleCount"
  | "pieces"
  | "username"
  | "type"
  | "orderId";

export function sortValue(order: Order, key: SortKey): string | number | Date {
  switch (key) {
    case "eventDate":
      return latestEventDate(order.timeline) ?? new Date(0);
    case "totalPrice":
      return order.summary.totalPrice!;
    case "itemValue":
      return order.summary.itemValue!;
    case "shippingPrice":
      return order.summary.shippingPrice!;
    case "articleCount":
      return order.summary.articleCount!;
    case "pieces":
      return totalPieces(order.articles);
    case "username":
      return order.otherUser.username ?? "";
    case "type":
      return order.type;
    case "orderId":
      return order.orderId;
  }
}
