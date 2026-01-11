import Database from "better-sqlite3";
import type { ArticleItem } from "./parser.types";

const CREATE_ARTICLES_SQL = `
  CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    name TEXT,
    amount INTEGER,
    link TEXT,
    expansion_name TEXT,
    collector_number TEXT,
    condition TEXT,
    language TEXT,
    price_each REAL,
    row_total REAL,
    comment TEXT,
    FOREIGN KEY(order_id) REFERENCES orders(order_id) ON DELETE CASCADE
  )
`;

interface ArticleRow {
  name: string | null;
  amount: number | null;
  link: string | null;
  expansion_name: string | null;
  collector_number: string | null;
  condition: string | null;
  language: string | null;
  price_each: number | null;
  row_total: number | null;
  comment: string | null;
}

export class ArticleRepository {
  private readonly insertStmt: Database.Statement<
    [
      string,
      string | null,
      number | null,
      string | null,
      string | null,
      string | null,
      string | null,
      string | null,
      number | null,
      number | null,
      string | null,
    ],
    Database.RunResult
  >;
  private readonly deleteByOrderStmt: Database.Statement<[string], Database.RunResult>;
  private readonly selectByOrderStmt: Database.Statement<[string], ArticleRow>;

  constructor(private readonly db: Database.Database) {
    this.ensureSchema();
    this.insertStmt = this.db.prepare<
      [
        string,
        string | null,
        number | null,
        string | null,
        string | null,
        string | null,
        string | null,
        string | null,
        number | null,
        number | null,
        string | null,
      ],
      Database.RunResult
    >(
      `
        INSERT INTO articles (
          order_id,
          name,
          amount,
          link,
          expansion_name,
          collector_number,
          condition,
          language,
          price_each,
          row_total,
          comment
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    );
    this.deleteByOrderStmt = this.db.prepare<[string], Database.RunResult>(
      "DELETE FROM articles WHERE order_id = ?",
    );
    this.selectByOrderStmt = this.db.prepare<[string], ArticleRow>(
      "SELECT name, amount, link, expansion_name, collector_number, condition, language, price_each, row_total, comment FROM articles WHERE order_id = ? ORDER BY id ASC",
    );
  }

  public replaceArticlesForOrder(orderId: string, articles: ArticleItem[]): void {
    const transaction = this.db.transaction((items: ArticleItem[]) => {
      this.deleteByOrderStmt.run(orderId);
      for (const article of items) {
        this.insertStmt.run(
          orderId,
          article.name,
          article.amount ?? null,
          article.link,
          article.expansionName,
          article.collectorNumber,
          article.condition,
          article.language,
          article.priceEach ?? null,
          article.rowTotalDisplayed ?? null,
          article.comment,
        );
      }
    });
    transaction(articles);
  }

  public getByOrder(orderId: string): ArticleItem[] {
    const rows = this.selectByOrderStmt.all(orderId);
    return rows.map((row) => ({
      name: row.name,
      amount: row.amount,
      link: row.link,
      expansionName: row.expansion_name,
      collectorNumber: row.collector_number,
      condition: row.condition,
      language: row.language,
      priceEach: row.price_each,
      rowTotalDisplayed: row.row_total,
      comment: row.comment,
    }));
  }

  private ensureSchema(): void {
    this.db.prepare(CREATE_ARTICLES_SQL).run();
  }
}
