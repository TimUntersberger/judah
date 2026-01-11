export interface ProductOverview {
  source: string;
  productId: string | null;
  productName: string | null;
  favorite?: boolean;
  lastFetched?: number | null;
  priceAverages?: {
    average1Day: number | null;
    average7Day: number | null;
    average30Day: number | null;
  };
}
