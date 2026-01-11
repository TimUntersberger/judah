import { CommonModule, CurrencyPipe, formatCurrency, TitleCasePipe, UpperCasePipe } from "@angular/common";
import { Component, computed, input, signal } from "@angular/core";
import { MatExpansionModule } from "@angular/material/expansion";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { Order, OrderTimelineEntry } from "../models/order.model";
import { OrderArticlesTableComponent } from "../order-articles-table/order-articles-table.component";
import { formatMoney, totalPieces } from "../utils/order-format";

@Component({
  selector: 'app-order-row',
  standalone: true,
  imports: [
    CommonModule,
    MatExpansionModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    OrderArticlesTableComponent,
    UpperCasePipe,
    CurrencyPipe,
  ],
  template: `
    <mat-expansion-panel>
      <mat-expansion-panel-header>
        <div class="header">
          <div class="left">
            <div [classList]="'orderType ' + orderTypeClass()">{{ order().type | uppercase }}</div>
            <div>{{ order().otherUser.username }}</div>
          </div>
          <div class="right">
            @if(lastUpdate()) {
          <div
            class="timeline-update"
            [style.color]="lastUpdateColor()"
          >
            {{ lastUpdate()![0] }} {{ lastUpdate()![1]!.date }}
          </div>
            }
            <div>{{ order().summary.totalPrice | currency : 'EUR' }}</div>
          </div>
        </div>
      </mat-expansion-panel-header>

      <mat-card>
        <app-order-articles-table [articles]="order().articles" />

        <button mat-stroked-button (click)="toggleJson()">
          <mat-icon>{{ showJson() ? 'expand_less' : 'expand_more' }}</mat-icon>
          JSON
        </button>

        @if (showJson()) {
        <pre>{{ order() | json }}</pre>
        }
      </mat-card>
    </mat-expansion-panel>
  `,
  styles: [
    `
      .header {
        display: flex;
        align-items: center;
        width: 100%;
        gap: 16px;
        padding: 16px 0;

        .orderType {
          font-size: 12px;
          border-radius: 10px;
          padding: 5px 15px;
          &.sell {
            color: red;
            border: 1px solid red;
          }
          &.buy {
            color: green;
            border: 1px solid green;
          }
        }
      }

      .left {
        display: flex;
        gap: 8px;
        align-items: center;
        margin-right: auto;
      }

      .right {
        display: flex;
        margin-left: auto;
        margin-right: 16px;
        align-items: center;
        gap: 8px;
      }

      .timeline-update {
        font-size: 12px;
        border-radius: 10px;
        padding: 5px 15px;
        border: 1px solid white;
      }
      .meta {
        font-size: 12px;
        opacity: 0.8;
      }
    `,
  ],
})
export class OrderRowComponent {
  public order = input.required<Order>();
  protected showJson = signal(false);

  protected orderTypeClass = computed(() => (this.order().type === 'sell' ? 'sell' : 'buy'));
  protected lastUpdateColor = computed(() => {
    const entry = this.lastUpdate();
    if (!entry) return "inherit";
    const label = entry[0].toLowerCase();

    if (label.includes("cancelled")) return "#f44336";
    if (label.includes("not arrived")) return "#ff9800";

    switch (label) {
      case "arrived":
        return "#4caf50";
      case "sent":
        return "#2196f3";
      case "paid":
        return "#009688";
      case "unpaid":
        return "#9e9e9e";
      default:
        return "inherit";
    }
  });

  protected lastUpdate = computed(() => {
    const alertStatus = this.order().timelineAlert;

    const alertEntry: [string, OrderTimelineEntry] | undefined =
      alertStatus && (alertStatus.status || alertStatus.message)
        ? [
            alertStatus.status === "cancelled"
              ? "Cancelled"
              : alertStatus.status === "notArrived"
              ? "Not arrived"
              : alertStatus.message,
            {
              date: alertStatus.date ?? "",
              time: alertStatus.time ?? "",
            },
          ]
        : undefined;

    const standard: [string, OrderTimelineEntry | undefined][] = [
      ["Arrived", this.order().timeline?.arrived],
      ["Sent", this.order().timeline?.sent],
      ["Paid", this.order().timeline?.paid],
      ["Unpaid", this.order().timeline?.unpaid],
    ];

    const entries: [string, OrderTimelineEntry][] = [];
    if (alertEntry && alertEntry[1]) {
      entries.push(alertEntry as [string, OrderTimelineEntry]);
    }

    for (const item of standard) {
      if (item[1]) {
        entries.push(item as [string, OrderTimelineEntry]);
      }
    }

    return entries.length ? entries[0] : undefined;
  });

  pieces = () => totalPieces(this.order().articles);
  money = formatMoney;

  toggleJson() {
    this.showJson.update((v) => !v);
  }
}
