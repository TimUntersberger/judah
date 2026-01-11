import { Injectable } from '@angular/core';
import { Order } from '../models/order.model';
import { Article } from '../models/article.model';
import { extractProductSlug } from '../utils/product-slug';

export interface ArticleStats {
  articleName: string;
  buyCount: number;
  sellCount: number;
  holdingCount: number;
  totalBought: number;
  totalSold: number;
  avgBuyPrice: number;
  avgSellPrice: number;
  totalCostIncludingFees: number;
  totalRevenueAfterFees: number;
  holdingValue: number;
  realizedProfitLoss: number;
  unrealizedProfitLoss: number;
  netProfitLoss: number;
  productSlug: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class ArticleStatsService {
  calculateArticleStats(ordersMap: { [key: string]: Order }): ArticleStats[] {
    const orders = Object.values(ordersMap);

    const articleData: Record<string, ArticleStats> = {};

    for(const order of orders) {
      if (!order.timeline?.arrived)
        continue;
      for (const article of order.articles) {
        if(!articleData[article.name]) {
        const slug = extractProductSlug(article.link);
        articleData[article.name] = {
          articleName: article.name,
          buyCount: 0,
          sellCount: 0,
          holdingCount: 0,
          totalBought: 0,
          totalSold: 0,
          avgBuyPrice: 0,
          avgSellPrice: 0,
          totalCostIncludingFees: 0,
          totalRevenueAfterFees: 0,
          holdingValue: 0,
          realizedProfitLoss: 0,
          unrealizedProfitLoss: 0,
          netProfitLoss: 0,
          productSlug: slug,
        };
      }
        const stats = articleData[article.name];
        const amount = article.amount ?? 0;
        const priceEach = article.priceEach ?? 0;
        const isSell = !order.otherUserAddress;
        const shippingPrice = order.summary?.shippingPrice ?? 0;
        const articleCount = order.summary?.articleCount ?? amount ?? 1;

        if (isSell) {
          stats.sellCount += amount;
          stats.totalSold += priceEach * amount;
        } else {
          const shippingShare = articleCount ? shippingPrice / articleCount : 0;
          const cost = priceEach + shippingShare;
          stats.buyCount += amount;
          stats.totalBought += cost * amount;
        }

        stats.totalCostIncludingFees = stats.totalBought;
        stats.totalRevenueAfterFees = stats.totalSold;
        const unitBuyPrice = stats.buyCount ? stats.totalBought / stats.buyCount : 0;
        const unitSellPrice = stats.sellCount ? stats.totalSold / stats.sellCount : 0;
        stats.avgBuyPrice = unitBuyPrice;
        stats.avgSellPrice = unitSellPrice;
        stats.holdingCount = Math.max(stats.buyCount - stats.sellCount, 0);
        this.updateHoldingValue(stats, stats.holdingCount * unitBuyPrice)
        console.log(stats.articleName, stats.unrealizedProfitLoss)
        stats.netProfitLoss = stats.realizedProfitLoss + stats.unrealizedProfitLoss;
      }
    }

    return Object.values(articleData);
  }

  public updateHoldingValue(stats: ArticleStats, value: number): void {
    const unitBuyPrice = stats.buyCount ? stats.totalBought / stats.buyCount : 0;
    stats.holdingValue = value;
    stats.realizedProfitLoss = stats.totalSold - unitBuyPrice * stats.sellCount;
    stats.unrealizedProfitLoss = stats.holdingValue - stats.holdingCount * stats.avgBuyPrice;
    stats.netProfitLoss = stats.unrealizedProfitLoss + stats.realizedProfitLoss;
    console.log(stats.articleName, stats.unrealizedProfitLoss)
  }
}
