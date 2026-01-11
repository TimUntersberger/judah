import { JsonPipe, CommonModule, NgIf, NgSwitch, NgSwitchCase } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { OrderHistoryViewComponent } from '../order-history/order-history-view.component';
import { ArticleStatsTableComponent } from '../order-history/components/article-stats-table/article-stats-table.component';
import { ProductManagerComponent } from '../order-history/components/product-manager/product-manager.component';
import { NavbarComponent } from './navbar/navbar.component';
import { Order } from '../order-history/models/order.model';
import { ProductOverview } from '../order-history/models/product.model';

@Component({
  selector: 'app-root',
  template: `
    <app-navbar (activeViewChange)="onViewChange($event)" />
    <div class="content">
      @if (loading()) {
      <div class="loading-indicator">Loading orders…</div>
      } @else { @switch (currentView()) { @case ("orders") {
      <section class="import-controls">
        <label>
          Start date
          <input
            type="date"
            [value]="startDate()"
            (input)="startDate.set($any($event.target).value)"
          />
        </label>
        <label>
          End date
          <input type="date" [value]="endDate()" (input)="endDate.set($any($event.target).value)" />
        </label>
        <button type="button" (click)="importOrders()" [disabled]="importing() || !startDate()">
          {{ importing() ? 'Importing…' : 'Import orders' }}
        </button>
      </section>

      @if (importStatus()) {
      <div class="status success">
        {{ importStatus() }}
      </div>
      } @if (importError()) {
      <div class="status error">
        {{ importError() }}
      </div>
      }
      <app-order-history-view [data]="data() ?? {}" />
      } @case ("articles") {
      <app-article-stats-table [ordersMap]="data() ?? {}" />
      } @case ("products") {
      <app-product-manager />
      } } }
    </div>
  `,
  imports: [
    JsonPipe,
    CommonModule,
    NgIf,
    NgSwitch,
    NgSwitchCase,
    OrderHistoryViewComponent,
    ArticleStatsTableComponent,
    ProductManagerComponent,
    NavbarComponent,
  ],
  styles: [
    `
      .content {
        overflow-y: auto;
      }

      .loading-indicator {
        padding: 1.5rem;
        text-align: center;
        font-weight: 600;
        color: rgba(0, 0, 0, 0.6);
      }

      .import-controls {
        display: flex;
        gap: 1rem;
        align-items: flex-end;
        padding: 1rem 0;
      }

      .import-controls label {
        display: flex;
        flex-direction: column;
        font-size: 0.9rem;
        color: rgba(0, 0, 0, 0.7);
      }

      .import-controls input {
        margin-top: 0.35rem;
      }

      .status {
        margin-bottom: 0.5rem;
        padding: 0.35rem 0.75rem;
        border-radius: 0.25rem;
        font-size: 0.85rem;
      }

      .status.success {
        background: rgba(76, 175, 80, 0.12);
        color: #2e7d32;
      }

      .status.error {
        background: rgba(244, 67, 54, 0.12);
        color: #c62828;
      }
    `,
  ],
})
export class AppComponent implements OnInit {
  protected data = signal<Record<string, Order> | null>(null);
  protected currentView = signal<'orders' | 'articles' | 'products'>('orders');
  loading = signal(true);

  protected startDate = signal(new Date().toISOString().split('T')[0]);
  protected endDate = signal('');
  protected importing = signal(false);
  protected importStatus = signal<string | null>(null);
  protected importError = signal<string | null>(null);

  async ngOnInit() {
    try {
      const orders = await window.api.orders.list();
      this.data.set(orders);
    } catch (err) {
      console.error('Failed to load orders', err);
    } finally {
      this.loading.set(false);
    }
  }

  onViewChange(view: 'orders' | 'articles' | 'products'): void {
    this.currentView.set(view);
  }

  async importOrders() {
    this.importing.set(true);
    this.importStatus.set(null);
    this.importError.set(null);

    try {
      const payload = {
        startDate: this.startDate(),
        endDate: this.endDate() || undefined,
      };
      const response = await window.api.orders.importRange(payload);
      const scanned = (response as { scanned?: number } | undefined)?.scanned ?? 0;
      this.importStatus.set(`Scanned ${scanned} order IDs.`);
      const refreshed = await window.api.orders.list();
      this.data.set(refreshed);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error while importing';
      this.importError.set(message);
      console.error('Order import failed', err);
    } finally {
      this.importing.set(false);
    }
  }
}

declare global {
  interface Window {
    api: {
      orders: {
        list: () => Promise<Record<string, Order>>;
        importRange: (payload: unknown) => Promise<unknown>;
      };
      products: {
        list: () => Promise<ProductOverview[]>;
        fetch: (url: string) => Promise<unknown>;
        setFavorite: (productId: string, favorite: boolean) => Promise<{ success: boolean }>;
        open: (url: string) => Promise<void>;
      };
    };
  }
}
