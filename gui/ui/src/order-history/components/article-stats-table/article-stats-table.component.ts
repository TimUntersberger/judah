import { Component, computed, input, OnInit, signal } from '@angular/core';
import { CurrencyPipe, NgClass } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { Order } from '../../models/order.model';
import { ArticleStats, ArticleStatsService } from '../../services/article-stats.service';

const DEFAULT_CURRENCY = 'EUR';

@Component({
  selector: 'app-article-stats-table',
  templateUrl: './article-stats-table.component.html',
  styleUrls: ['./article-stats-table.component.css'],
  imports: [
    CurrencyPipe,
    NgClass,
    MatCardModule,
    MatChipsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ]
})
export class ArticleStatsTableComponent implements OnInit {
  public ordersMap = input.required<{ [key: string]: Order }>();
  protected readonly CURRENCY = DEFAULT_CURRENCY;

  protected readonly statProps: (keyof ArticleStats)[] = [
    'articleName',
    'buyCount',
    'sellCount',
    'holdingCount',
    'holdingValue',
    'avgBuyPrice',
    'avgSellPrice',
    'totalCostIncludingFees',
    'totalRevenueAfterFees',
    'realizedProfitLoss',
    'unrealizedProfitLoss',
    'netProfitLoss',
  ];

  protected readonly stats = signal<ArticleStats[]>([]);
  protected readonly filteredStats = computed(() => {
    const filterText = this.filterText().trim().toLowerCase();
    const filtered = filterText
      ? this.stats().filter((stat) => stat.articleName.toLowerCase().includes(filterText))
      : this.stats();
    return this.sortStats(filtered, this.sortColumn(), this.sortDirection());
  });

  protected readonly sortColumn = signal<keyof ArticleStats>('netProfitLoss');
  protected readonly sortDirection = signal<'asc' | 'desc'>('desc');
  protected readonly filterText = signal('');
  protected readonly error = signal<string | null>(null);

  protected readonly hasError = computed(() => !!this.error());
  protected readonly hasNoResults = computed(() => !this.hasError() && this.filteredStats().length === 0);

  protected readonly refreshingSlugs = signal<string[]>([]);

  private rawStats: ArticleStats[] = [];
  protected readonly productAvgMap = signal<Record<string, number>>({});
  protected readonly productSourceMap = signal<Record<string, string>>({});

  constructor(private readonly articleStatsService: ArticleStatsService) {}

  ngOnInit(): void {
    this.loadStats();
  }

  protected loadStats(): void {
    this.refreshStats();
    void this.loadProductPrices();
  }

  protected onSort(column: keyof ArticleStats): void {
    if (this.sortColumn() === column) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
      return;
    }
    this.sortColumn.set(column);
    this.sortDirection.set('desc');
  }

  protected onFilterChange(value: string): void {
    this.filterText.set(value);
  }

  protected getProfitLossClass(value: number): string {
    if (value > 0) return 'profit';
    if (value < 0) return 'loss';
    return 'neutral';
  }

  private refreshStats(): void {
    const orderData = this.ordersMap();
    if (Object.keys(orderData).length === 0) {
      this.rawStats = [];
      this.stats.set([]);
      return;
    }

    try {
      this.rawStats = this.articleStatsService.calculateArticleStats(orderData);
      this.updateStatsWithPricing();
      this.error.set(null);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Unknown error calculating stats');
      console.error('Error loading article stats:', err);
    }
  }

  private sortStats(
    stats: ArticleStats[],
    column: keyof ArticleStats,
    direction: 'asc' | 'desc'
  ): ArticleStats[] {
    const sorted = [...stats];
    sorted.sort((a, b) => {
      const aVal = a[column];
      const bVal = b[column];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const aText = String(aVal ?? '').toLowerCase();
      const bText = String(bVal ?? '').toLowerCase();
      if (aText === bText) return 0;
      return direction === 'asc' ? (aText > bText ? 1 : -1) : (aText < bText ? 1 : -1);
    });
    return sorted;
  }

  private updateStatsWithPricing(): void {
    if (!this.rawStats.length) {
      this.stats.set([]);
      return;
    }
    const priced = this.applyPricing(this.rawStats, this.productAvgMap());
    this.stats.set(priced);
  }

  private applyPricing(stats: ArticleStats[], priceMap: Record<string, number>): ArticleStats[] {
    return stats.map((stat) => {
      const updated = { ...stat };
      const productSlug = updated.productSlug ?? '';
      const avgPrice = productSlug && priceMap[productSlug] !== undefined ? priceMap[productSlug] : updated.avgBuyPrice;
      this.articleStatsService.updateHoldingValue(updated, updated.holdingCount * avgPrice);
      return updated;
    });
  }

  protected async loadProductPrices(): Promise<void> {
    try {
      const products = await window.api.products.list();
      const map: Record<string, number> = {};
      const sourceMap: Record<string, string> = {};
      for (const product of products) {
        const slug = product.productId;
        const avg7 = product.priceAverages?.average7Day;
        if (slug && avg7 != null) {
          map[slug] = avg7;
        }
        if (slug && product.source) {
          sourceMap[slug] = product.source;
        }
      }
      this.productAvgMap.set(map);
      this.productSourceMap.set(sourceMap);
      this.updateStatsWithPricing();
    } catch (err) {
      console.error('Failed to load product prices', err);
    }
  }

  protected async refreshProductForStat(stat: ArticleStats): Promise<void> {
    const slug = stat.productSlug;
    if (!slug)
      return;

    const sourceMap = this.productSourceMap();
    const productSource = slug ? sourceMap[slug] : undefined;
    if (!productSource) {
      return;
    }

    this.addRefreshingSlug(slug);
    try {
      await window.api.products.fetch(productSource);
      await this.loadProductPrices();
    } catch (err) {
      console.error('Failed to refresh product for article stat', err);
    } finally {
      this.removeRefreshingSlug(slug);
    }
  }

  protected isRefreshingSlug(slug?: string | null): boolean {
    if (!slug) {
      return false;
    }
    return this.refreshingSlugs().includes(slug);
  }

  protected formatProfitPercent(stat: ArticleStats): string {
    const comparisonBase =
      Math.abs(stat.totalCostIncludingFees) ||
      Math.abs(stat.holdingValue) ||
      Math.abs(stat.avgBuyPrice) ||
      1;
    const percent = (stat.netProfitLoss / comparisonBase) * 100;
    const sign = percent > 0 ? '+' : percent < 0 ? '' : '';
    return `${sign}${percent.toFixed(1)}%`;
  }

  protected getHoldingClass(stat: ArticleStats): string {
    if (stat.holdingCount > 0) return 'positive-holding';
    if (stat.holdingCount < 0) return 'negative-holding';
    return 'neutral-holding';
  }

  protected getHoldingChipColor(stat: ArticleStats): 'primary' | 'accent' | 'warn' {
    if (stat.holdingCount > 0) return 'primary';
    if (stat.holdingCount < 0) return 'warn';
    return 'accent';
  }

  private addRefreshingSlug(slug: string): void {
    this.refreshingSlugs.update((current) => {
      if (current.includes(slug)) {
        return current;
      }
      return [...current, slug];
    });
  }

  private removeRefreshingSlug(slug: string): void {
    this.refreshingSlugs.update((current) => current.filter((item) => item !== slug));
  }
}
