export interface Article {
  name: string;
  amount: number;
  link: string;
  expansionName?: string | null;
  collectorNumber?: string | null;
  condition?: string | null;
  language?: string | null;
  priceEach?: number | null;
  rowTotalDisplayed?: number | null;
  comment?: string | null;
}