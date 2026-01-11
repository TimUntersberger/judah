import { CommonModule } from "@angular/common";
import { Component, computed, effect, input, signal } from "@angular/core";
import { MatPaginatorModule, PageEvent } from "@angular/material/paginator";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { OrderRowComponent } from "./order-row/order-row.component";
import { Order } from "./models/order.model";
import { sortValue, SortKey } from "./utils/order-sorting";

@Component({
  selector: "app-order-history-view",
  standalone: true,
  imports: [
    CommonModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    OrderRowComponent,
  ],
  template: `
    <div class="toolbar">
      <mat-form-field>
        <input matInput placeholder="Search" (input)="query.set($any($event.target).value)" />
      </mat-form-field>

      <mat-form-field>
        <mat-select [value]="sortKey()" (selectionChange)="sortKey.set($event.value)">
          <mat-option value="eventDate">Date</mat-option>
          <mat-option value="totalPrice">Total</mat-option>
          <mat-option value="pieces">Pieces</mat-option>
          <mat-option value="username">User</mat-option>
        </mat-select>
      </mat-form-field>
    </div>

    @for (o of paged(); track o.orderId) {
      <app-order-row [order]="o" />
    }

    <mat-paginator
      [length]="filtered().length"
      [pageSize]="pageSize()"
      (page)="onPage($event)"
    />
  `,
  styles: `
  `
})
export class OrderHistoryViewComponent {
  data = input.required<Record<string, Order>>();

  query = signal("");
  sortKey = signal<SortKey>("eventDate");
  sortDir = signal<1 | -1>(-1);

  pageIndex = signal(0);
  pageSize = signal(25);

  entries = computed(() => Object.values(this.data()));

  filtered = computed(() =>
    this.entries().filter(o =>
      JSON.stringify(o).toLowerCase().includes(this.query().toLowerCase())
    )
  );

  sorted = computed(() =>
    [...this.filtered()].sort(
      (a, b) =>
        (sortValue(a, this.sortKey()) as any >
        sortValue(b, this.sortKey())
          ? 1
          : -1) * this.sortDir()
    )
  );

  paged = computed(() =>
    this.sorted().slice(
      this.pageIndex() * this.pageSize(),
      (this.pageIndex() + 1) * this.pageSize()
    )
  );

  onPage(e: PageEvent) {
    this.pageIndex.set(e.pageIndex);
    this.pageSize.set(e.pageSize);
  }

  constructor() {
    effect(() => {
      this.query();
      this.sortKey();
      this.pageIndex.set(0);
    });
  }
}
