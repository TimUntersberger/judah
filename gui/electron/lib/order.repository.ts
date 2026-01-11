import path from "node:path";
import Database from "better-sqlite3";
import type {
  AddressBlock,
  ArticleItem,
  OrderJson,
  RefundTotals,
  ShippingInfo,
  TimelineAlert,
  TimelineEntry,
} from "./parser.types";
import { ArticleRepository } from "./article.repository";

const CREATE_ORDERS_SQL = `
  CREATE TABLE IF NOT EXISTS orders (
    order_id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    type TEXT NOT NULL,
    other_username TEXT,
    other_location TEXT,
    timeline TEXT,
    timeline_alert_status TEXT,
    timeline_alert_message TEXT,
    timeline_alert_date TEXT,
    timeline_alert_time TEXT,
    summary_article_count INTEGER,
    summary_item_value REAL,
    summary_shipping_price REAL,
    summary_trustee_service REAL,
    summary_total_price REAL,
    other_address TEXT,
    user_address TEXT,
    shipping_method TEXT,
    shipping_tracking TEXT,
    refund_totals TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )
`;

interface OrderRow {
  order_id: string;
  source: string;
  type: string;
  other_username: string | null;
  other_location: string | null;
  timeline: string | null;
  timeline_alert_status: string | null;
  timeline_alert_message: string | null;
  timeline_alert_date: string | null;
  timeline_alert_time: string | null;
  summary_article_count: number | null;
  summary_item_value: number | null;
  summary_shipping_price: number | null;
  summary_trustee_service: number | null;
  summary_total_price: number | null;
  other_address: string | null;
  user_address: string | null;
  shipping_method: string | null;
  shipping_tracking: string | null;
  refund_totals: string | null;
  created_at: number;
  updated_at: number;
}

export class OrderRepository {
  private readonly db: Database.Database;
  private readonly articleRepo: ArticleRepository;
  private readonly upsertStmt: Database.Statement<
    [
      string, // order_id
      string, // source
      string, // type
      string | null, // other_username
      string | null, // other_location
      string | null, // timeline
      string | null, // timeline_alert_status
      string | null, // timeline_alert_message
      string | null, // timeline_alert_date
      string | null, // timeline_alert_time
      number | null, // summary_article_count
      number | null, // summary_item_value
      number | null, // summary_shipping_price
      number | null, // summary_trustee_service
      number | null, // summary_total_price
      string | null, // other_address
      string | null, // user_address
      string | null, // shipping_method
      string | null, // shipping_tracking
      string | null, // refund_totals
      number, // created_at
      number, // updated_at
    ],
    Database.RunResult
  >;
  private readonly selectStmt: Database.Statement<[string], OrderRow | undefined>;
  private readonly selectAllStmt: Database.Statement<[], OrderRow>;
  private readonly existsStmt: Database.Statement<[string], { hasOrder: number }>;

  constructor(dbFilePath: string) {
    const resolvedPath = path.resolve(process.cwd(), dbFilePath);
    this.db = new Database(resolvedPath);
    this.ensureSchema();

    this.articleRepo = new ArticleRepository(this.db);

    this.upsertStmt = this.db.prepare<
      [
        string, // order_id
        string, // source
        string, // type
        string | null, // other_username
        string | null, // other_location
        string | null, // timeline
        string | null, // timeline_alert_status
        string | null, // timeline_alert_message
        string | null, // timeline_alert_date
        string | null, // timeline_alert_time
        number | null, // summary_article_count
        number | null, // summary_item_value
        number | null, // summary_shipping_price
        number | null, // summary_trustee_service
        number | null, // summary_total_price
        string | null, // other_address
        string | null, // user_address
        string | null, // shipping_method
        string | null, // shipping_tracking
        string | null, // refund_totals
        number, // created_at
        number, // updated_at
      ],
      Database.RunResult
    >(
      `
        INSERT INTO orders (
          order_id,
          source,
          type,
          other_username,
          other_location,
          timeline,
          timeline_alert_status,
          timeline_alert_message,
          timeline_alert_date,
          timeline_alert_time,
          summary_article_count,
          summary_item_value,
          summary_shipping_price,
          summary_trustee_service,
          summary_total_price,
          other_address,
          user_address,
          shipping_method,
          shipping_tracking,
          refund_totals,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(order_id) DO UPDATE SET
          source = excluded.source,
          type = excluded.type,
          other_username = excluded.other_username,
          other_location = excluded.other_location,
          timeline = excluded.timeline,
          timeline_alert_status = excluded.timeline_alert_status,
          timeline_alert_message = excluded.timeline_alert_message,
          timeline_alert_date = excluded.timeline_alert_date,
          timeline_alert_time = excluded.timeline_alert_time,
          summary_article_count = excluded.summary_article_count,
          summary_item_value = excluded.summary_item_value,
          summary_shipping_price = excluded.summary_shipping_price,
          summary_trustee_service = excluded.summary_trustee_service,
          summary_total_price = excluded.summary_total_price,
          other_address = excluded.other_address,
          user_address = excluded.user_address,
          shipping_method = excluded.shipping_method,
          shipping_tracking = excluded.shipping_tracking,
          refund_totals = excluded.refund_totals,
          updated_at = excluded.updated_at
      `,
    );

    this.selectStmt = this.db.prepare<[string], OrderRow | undefined>(
      "SELECT * FROM orders WHERE order_id = ?",
    );
    this.selectAllStmt = this.db.prepare<[], OrderRow>("SELECT * FROM orders");
    this.existsStmt = this.db.prepare<[string], { hasOrder: number }>(
      "SELECT EXISTS(SELECT 1 FROM orders WHERE order_id = ?) AS hasOrder",
    );
  }

  public async load(): Promise<void> {
    return;
  }

  public async save(): Promise<void> {
    return;
  }

  public has(orderId: string): boolean {
    const row = this.existsStmt.get(orderId);
    return row?.hasOrder === 1;
  }

  public get(orderId: string): OrderJson | undefined {
    const row = this.selectStmt.get(orderId);
    if (!row) {
      return undefined;
    }
    const articles = this.articleRepo.getByOrder(orderId);
    return this.buildOrderFromRow(row, articles);
  }

  public add(orderId: string, order: OrderJson): void {
    const resolvedOrderId = (order.orderId?.trim() || orderId).trim();
    if (!resolvedOrderId) {
      return;
    }

    const now = Date.now();
    const summary = order.summary;
    const shipping = order.shipping;
    const otherUser = order.otherUser;
    const timelineAlert = order.timelineAlert;

      this.upsertStmt.run(
        resolvedOrderId,
        order.source,
        order.type,
        otherUser?.username ?? null,
        otherUser?.location ?? null,
        this.stringifyIfNotEmpty(order.timeline),
        timelineAlert?.status ?? null,
        timelineAlert?.message ?? null,
        timelineAlert?.date ?? null,
        timelineAlert?.time ?? null,
        summary?.articleCount ?? null,
        summary?.itemValue ?? null,
        summary?.shippingPrice ?? null,
        summary?.trusteeService ?? null,
        summary?.totalPrice ?? null,
        this.toJson(order.otherUserAddress),
        this.toJson(order.userAddress),
        shipping?.shippingMethod ?? null,
        shipping?.trackingCode ?? null,
        this.stringifyRefundTotals(shipping?.refundTotals ?? null),
        now,
        now,
      );

    this.articleRepo.replaceArticlesForOrder(resolvedOrderId, order.articles ?? []);
  }

  public getAll(): Record<string, OrderJson> {
    const rows = this.selectAllStmt.all();
    const result: Record<string, OrderJson> = {};
    for (const row of rows) {
      result[row.order_id] = this.buildOrderFromRow(
        row,
        this.articleRepo.getByOrder(row.order_id),
      );
    }
    return result;
  }

  public remove(orderId: string): boolean {
    const row = this.selectStmt.get(orderId);
    if (!row) return false;
    this.articleRepo.replaceArticlesForOrder(orderId, []);
    const info = this.db.prepare("DELETE FROM orders WHERE order_id = ?").run(orderId);
    return info.changes > 0;
  }

  public close(): void {
    this.db.close();
  }

  private ensureSchema(): void {
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.prepare(CREATE_ORDERS_SQL).run();
  }

  private buildOrderFromRow(row: OrderRow, articles: ArticleItem[]): OrderJson {
    return {
      source: row.source,
      orderId: row.order_id,
      type: row.type as "buy" | "sell",
      otherUser: {
        username: row.other_username,
        location: row.other_location,
      },
      timeline: this.parseTimeline(row.timeline),
      timelineAlert: this.buildTimelineAlert(row),
      summary: this.parseSummary(row),
      otherUserAddress: this.parseJson<AddressBlock>(row.other_address),
      userAddress: this.parseJson<AddressBlock>(row.user_address),
      shipping: this.buildShipping(row),
      articles,
    };
  }

  private parseJson<T>(text: string | null): T | null {
    if (!text) return null;
    try {
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  }

  private parseSummary(row: OrderRow) {
    const hasSummary =
      row.summary_article_count !== null ||
      row.summary_item_value !== null ||
      row.summary_shipping_price !== null ||
      row.summary_trustee_service !== null ||
      row.summary_total_price !== null;

    if (!hasSummary) {
      return null;
    }

    return {
      articleCount: row.summary_article_count,
      itemValue: row.summary_item_value,
      shippingPrice: row.summary_shipping_price,
      trusteeService: row.summary_trustee_service,
      totalPrice: row.summary_total_price,
    };
  }

  private parseTimeline(text: string | null): Record<string, TimelineEntry> {
    if (!text) {
      return {};
    }
    try {
      return JSON.parse(text) as Record<string, TimelineEntry>;
    } catch {
      return {};
    }
  }

  private stringifyIfNotEmpty(value: Record<string, TimelineEntry> | null): string | null {
    if (!value) {
      return null;
    }
    const keys = Object.keys(value);
    if (keys.length === 0) {
      return null;
    }
    return JSON.stringify(value);
  }

  private toJson(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    return JSON.stringify(value);
  }

  private buildTimelineAlert(row: OrderRow): TimelineAlert | null {
    const status = (row.timeline_alert_status as TimelineAlert["status"]) ?? null;
    const message =
      row.timeline_alert_message ??
      (status === "cancelled"
        ? "Order cancelled"
        : status === "notArrived"
        ? "Not arrived"
        : "");

    if (!status && !message) return null;
    return {
      status,
      message,
      date: row.timeline_alert_date,
      time: row.timeline_alert_time,
    };
  }

  private stringifyRefundTotals(value: RefundTotals | null | undefined): string | null {
    if (!value) return null;
    const entries = Object.entries(value);
    if (entries.length === 0) return null;
    return JSON.stringify(value);
  }

  private parseRefundTotals(text: string | null): RefundTotals | null {
    if (!text) return null;
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed !== "object" || parsed === null) return null;
      return parsed as RefundTotals;
    } catch {
      return null;
    }
  }

  private buildShipping(row: OrderRow): ShippingInfo | null {
    const refundTotals = this.parseRefundTotals(row.refund_totals);
    if (!row.shipping_method && !row.shipping_tracking && !refundTotals) {
      return null;
    }
    return {
      shippingMethod: row.shipping_method,
      trackingCode: row.shipping_tracking,
      refundTotals,
    };
  }
}
