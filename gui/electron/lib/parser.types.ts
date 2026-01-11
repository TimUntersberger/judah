// src/types.ts

export type TimelineEntry = {
  date: string | null;
  time: string | null;
};

export type TimelineAlert = {
  status: "cancelled" | "notArrived" | null;
  message: string;
  date?: string | null;
  time?: string | null;
};

export type RefundTotals = Record<string, number>;

export type AddressBlock = {
  name: string | null;
  extra: string | null;
  street: string | null;
  city: string | null;
  country: string | null;
};

export type ProductSellerInfo = {
  username: string | null;
  profileUrl: string | null;
  location: string | null;
  rating: string | null;
  salesCount: number | null;
  availableItems: number | null;
  estimatedDeliveryDays: number | null;
  professional: boolean;
};

export type ProductOffer = {
  articleId: string | null;
  priceEach: number | null;
  stock: number | null;
  condition: string | null;
  language: string | null;
  comment: string | null;
  seller: ProductSellerInfo;
};

export type ProductInfoList = Record<string, string | null>;

export type ProductPriceAverages = {
  average1Day: number | null;
  average7Day: number | null;
  average30Day: number | null;
};

export type ProductPage = {
  source: string;
  productName: string | null;
  productId: string | null;
  offers: ProductOffer[];
  infoList: ProductInfoList;
  priceAverages: ProductPriceAverages;
  favorite?: boolean;
  lastFetched?: number | null;
};

export type ArticleItem = {
  // Derived from the product link href last path segment (slug), e.g. "Monkey-D-Luffy" -> "Monkey D Luffy"
  name: string | null;

  amount: number | null;

  expansionName: string | null;
  collectorNumber: string | null;

  condition: string | null;
  language: string | null;

  priceEach: number | null;
  rowTotalDisplayed: number | null;

  comment: string | null;

  link: string | null;
};

export type OrderSummary = {
  articleCount: number | null;
  itemValue: number | null;
  shippingPrice: number | null;
  trusteeService: number | null;
  totalPrice: number | null;
};

export type ShippingInfo = {
  shippingMethod: string | null;
  trackingCode: string | null;
  refundTotals?: RefundTotals | null;
};

export type OtherUserInfo = {
  username: string | null;
  location: string | null;
};

export type OrderJson = {
  source: string;
  orderId: string | null;
  type: "sell" | "buy";

  otherUser: OtherUserInfo;
  timeline: Record<string, TimelineEntry>;
  timelineAlert: TimelineAlert | null;

  summary: OrderSummary | null;

  otherUserAddress: AddressBlock | null;
  userAddress: AddressBlock | null;

  shipping: ShippingInfo | null;

  articles: ArticleItem[];
};
