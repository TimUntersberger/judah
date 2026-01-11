import { CommonModule } from "@angular/common";
import { Component, computed, effect, OnInit, signal } from "@angular/core";
import { MatToolbarModule } from "@angular/material/toolbar";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatCardModule } from "@angular/material/card";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { ProductOverview } from "../../models/product.model";

@Component({
  selector: "app-product-manager",
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatCheckboxModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <section>
      <mat-toolbar color="primary">
        <mat-checkbox
          [checked]="favoritesOnly()"
          (change)="favoritesOnly.set($event.checked)"
        >
          Favorites only
        </mat-checkbox>
        <span class="mat-toolbar-spacer"></span>
        <button
          mat-stroked-button
          color="accent"
          (click)="loadProducts()"
          [disabled]="loading()"
        >
          Refresh list
        </button>
        <button
          mat-stroked-button
          color="warn"
          (click)="refreshAllProducts()"
          [disabled]="loading() || fetchingAll()"
        >
          <mat-progress-spinner
            *ngIf="fetchingAll()"
            diameter="20"
            mode="indeterminate"
          ></mat-progress-spinner>
          <span *ngIf="!fetchingAll()">Fetch everything</span>
        </button>
      </mat-toolbar>

      @if (error()) {
        <mat-card>
          <mat-card-content>{{ error() }}</mat-card-content>
        </mat-card>
      }

      @if (loading()) {
        <mat-card>
          <mat-card-content class="loading-row">
            <mat-progress-spinner diameter="24" mode="indeterminate"></mat-progress-spinner>
            <span>Loading products…</span>
          </mat-card-content>
        </mat-card>
      } @else {
        @if (filtered().length === 0) {
          <mat-card>
            <mat-card-content>
              No products yet. Use the refresh button to fetch again.
            </mat-card-content>
          </mat-card>
        } @else {
          @for (product of filtered(); track product.productId ?? product.source) {
            <mat-card>
              <mat-card-header>
                <div class="header-content">
                  <div>
                    <mat-card-title>
                      {{ product.productName ?? product.productId ?? "Unnamed product" }}
                    </mat-card-title>
                    @if (expansionSubtitle(product)) {
                      <mat-card-subtitle class="expansion-subtitle">
                        {{ expansionSubtitle(product) }}
                      </mat-card-subtitle>
                    }
                  </div>
                  <div class="header-actions">
                    <button
                      mat-icon-button
                      aria-label="refresh product"
                      (click)="refreshProduct(product)"
                      [disabled]="isRefreshing(product)"
                    >
                      <mat-progress-spinner
                        *ngIf="isRefreshing(product)"
                        diameter="20"
                        mode="indeterminate"
                      ></mat-progress-spinner>
                      <mat-icon *ngIf="!isRefreshing(product)">refresh</mat-icon>
                    </button>
                    <button
                      mat-icon-button
                      aria-label="toggle favorite"
                      (click)="toggleFavorite(product)"
                    >
                      <mat-icon color="warn">{{ product.favorite ? "favorite" : "favorite_border" }}</mat-icon>
                    </button>
                    <button
                      mat-icon-button
                      aria-label="open product page"
                      (click)="openProduct(product)"
                    >
                      <mat-icon>open_in_new</mat-icon>
                    </button>
                  </div>
                </div>
              </mat-card-header>
              <mat-card-content>
                <p>Last fetched: {{ formatTimestamp(product.lastFetched) }}</p>
                @if (hasPriceData(product)) {
                  <div class="price-row">
                    <span class="price-pill">1d {{ formatAverage(product.priceAverages?.average1Day) }}</span>
                    <span class="price-pill">7d {{ formatAverage(product.priceAverages?.average7Day) }}</span>
                    <span class="price-pill">30d {{ formatAverage(product.priceAverages?.average30Day) }}</span>
                  </div>
                } @else {
                  <p>No price data yet.</p>
                }
              </mat-card-content>
            </mat-card>
          }
        }
      }
    </section>
  `,
  styles: [
    `
      .expansion-subtitle {
        color: #9e9e9e;
        font-size: 0.85rem;
      }

      .header-content {
        width: 100%;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1rem;
      }

      .header-actions {
        display: flex;
        gap: 0.3rem;
      }

      .loading-row {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .price-row {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
        margin-top: 0.25rem;
      }

      .price-pill {
        background: rgba(0, 0, 0, 0.04);
        border-radius: 999px;
        padding: 0.15rem 0.8rem;
        font-size: 0.8rem;
      }
    `,
  ],
})
export class ProductManagerComponent implements OnInit {
  protected products = signal<ProductOverview[]>([]);
  protected loading = signal(false);
  protected error = signal<string | null>(null);
  protected favoritesOnly = signal(false);
  protected refreshingIds = signal<string[]>([]);
  protected fetchingAll = signal(false);

  protected filtered = computed(() => {
    return this.products().filter((product) => {
      return !this.favoritesOnly() || product.favorite;
    });
  });

  async ngOnInit(): Promise<void> {
    await this.loadProducts();
  }

  async loadProducts(): Promise<void> {
    this.loading.set(true);
    try {
      const items = await window.api.products.list();
      this.products.set(items);
      this.error.set(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load products";
      this.error.set(message);
      console.error("Failed to load products", err);
    } finally {
      this.loading.set(false);
    }
  }

  protected async refreshProduct(product: ProductOverview): Promise<void> {
    const key = product.productId ?? product.source;
    if (!key) return;

    this.addRefreshing(key);
    try {
      await window.api.products.fetch(product.source);
      await this.loadProducts();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to refresh product";
      this.error.set(message);
      console.error("Product refresh failed", err);
    } finally {
      this.removeRefreshing(key);
    }
  }

  protected async toggleFavorite(product: ProductOverview): Promise<void> {
    const productId = product.productId ?? product.source;
    if (!productId) {
      return;
    }

    const nextValue = !product.favorite;
    try {
      await window.api.products.setFavorite(productId, nextValue);
      this.products.update((current) =>
        current.map((item) =>
          item.productId === product.productId ? { ...item, favorite: nextValue } : item,
        ),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not update favorite flag";
      this.error.set(message);
      console.error("Failed to toggle favorite", err);
    }
  }

  protected openProduct(product: ProductOverview): void {
    if (!product.source) {
      return;
    }
    window.api.products.open(product.source);
  }

  protected isRefreshing(product: ProductOverview): boolean {
    const key = product.productId ?? product.source;
    return !!key && this.refreshingIds().includes(key);
  }

  protected async refreshAllProducts(): Promise<void> {
    if (!window.confirm('This will refetch every product and may take a while. Continue?')) {
      return;
    }

    this.fetchingAll.set(true);
    try {
      const products = this.products();
      for (const product of products) {
        if (!product.source) continue;
        await window.api.products.fetch(product.source);
        await this.randomDelay(1000, 3000);
      }
      await this.loadProducts();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh all products';
      this.error.set(message);
      console.error('Failed to refresh all products', err);
    } finally {
      this.fetchingAll.set(false);
    }
  }

  protected formatTimestamp(value?: number | null): string {
    if (!value) return "never";
    return new Date(value).toLocaleString();
  }

  protected hasPriceData(product: ProductOverview): boolean {
    return (
      !!product.priceAverages &&
      (product.priceAverages.average1Day !== null ||
        product.priceAverages.average7Day !== null ||
        product.priceAverages.average30Day !== null)
    );
  }

  protected formatAverage(value?: number | null): string {
    if (value === null || value === undefined) {
      return "—";
    }
    return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
  }

  protected expansionSubtitle(product: ProductOverview): string | null {
    const id = product.productId;
    if (!id) {
      return null;
    }
    const parts = id.split("/");
    if (parts.length >= 2) {
      return parts[parts.length - 2];
    }
    return parts[0] || null;
  }

  private addRefreshing(key: string): void {
    this.refreshingIds.update((current) => {
      if (current.includes(key)) return current;
      return [...current, key];
    });
  }

  private removeRefreshing(key: string): void {
    this.refreshingIds.update((current) => current.filter((item) => item !== key));
  }

  private randomDelay(minMs: number, maxMs: number): Promise<void> {
    const delay = minMs + Math.floor(Math.random() * (maxMs - minMs));
    return new Promise((resolve) => setTimeout(resolve, delay));
  }
}
