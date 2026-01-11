import { CommonModule } from "@angular/common";
import { Component, input } from "@angular/core";
import { MatTableModule } from "@angular/material/table";
import { Article } from "../models/article.model";
import { articleLineTotal, formatMoney } from "../utils/order-format";

@Component({
  selector: "app-order-articles-table",
  standalone: true,
  imports: [CommonModule, MatTableModule],
  template: `
    <div class="tableWrap">
      <table mat-table [dataSource]="articles()" class="articlesTable">
        <ng-container matColumnDef="amount">
          <th mat-header-cell *matHeaderCellDef>Qty</th>
          <td mat-cell *matCellDef="let a">{{ a.amount }}</td>
        </ng-container>

        <ng-container matColumnDef="name">
          <th mat-header-cell *matHeaderCellDef>Card</th>
          <td mat-cell *matCellDef="let a">
            <div class="cellMain">{{ a.name }}</div>
            <div class="cellSub">
              {{ a.expansionName }}
              @if (a.collectorNumber) { • #{{ a.collectorNumber }} }
            </div>
          </td>
        </ng-container>

        <ng-container matColumnDef="condition">
          <th mat-header-cell *matHeaderCellDef>Cond</th>
          <td mat-cell *matCellDef="let a">{{ a.condition ?? "—" }}</td>
        </ng-container>

        <ng-container matColumnDef="language">
          <th mat-header-cell *matHeaderCellDef>Lang</th>
          <td mat-cell *matCellDef="let a">{{ a.language ?? "—" }}</td>
        </ng-container>

        <ng-container matColumnDef="each">
          <th mat-header-cell *matHeaderCellDef>Each</th>
          <td mat-cell *matCellDef="let a">{{ money(a.priceEach) }}</td>
        </ng-container>

        <ng-container matColumnDef="total">
          <th mat-header-cell *matHeaderCellDef>Total</th>
          <td mat-cell *matCellDef="let a">{{ money(lineTotal(a)) }}</td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="cols"></tr>
        <tr mat-row *matRowDef="let row; columns: cols"></tr>
      </table>
    </div>
  `,
  styles: [
    `
      .tableWrap {
        overflow: auto;
        border-radius: 14px;
      }
      .articlesTable {
        width: 100%;
        min-width: 900px;
      }
      .cellMain {
        font-weight: 700;
      }
      .cellSub {
        font-size: 12px;
        opacity: 0.8;
      }
    `,
  ],
})
export class OrderArticlesTableComponent {
  articles = input.required<Article[]>();

  readonly cols = ["amount", "name", "condition", "language", "each", "total"];

  money = formatMoney;
  lineTotal = articleLineTotal;
}
