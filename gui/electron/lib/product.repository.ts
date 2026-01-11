import path from "node:path";
import Database from "better-sqlite3";
import type {
  ArticleItem,
  ProductPage,
  ProductPriceAverages,
} from "./parser.types";

const CREATE_PRODUCTS_SQL = `
  CREATE TABLE IF NOT EXISTS products (
    product_id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    product_name TEXT,
    avg_1d REAL,
    avg_7d REAL,
    avg_30d REAL,
    last_fetched INTEGER NOT NULL
    ,
    is_favorite INTEGER DEFAULT 0
  )
`;

interface ProductRow {
  product_id: string;
  source: string;
  product_name: string | null;
  avg_1d: number | null;
  avg_7d: number | null;
  avg_30d: number | null;
  last_fetched: number;
  is_favorite: number;
}

export class ProductRepository {
  private readonly db: Database.Database;
  private readonly upsertStmt: Database.Statement<
    [string, string, string | null, number | null, number | null, number | null, number, number],
    Database.RunResult
  >;
  private readonly placeholderStmt: Database.Statement<[string, string, number], Database.RunResult>;
  private readonly selectStmt: Database.Statement<[string], ProductRow | undefined>;
  private readonly selectAllStmt: Database.Statement<[], ProductRow>;
  private readonly favoriteStmt: Database.Statement<[number, string], Database.RunResult>;

  constructor(dbFilePath: string) {
    const resolvedPath = path.resolve(process.cwd(), dbFilePath);
    this.db = new Database(resolvedPath);
    this.ensureSchema();

    this.upsertStmt = this.db.prepare<
      [string, string, string | null, number | null, number | null, number | null, number, number],
      Database.RunResult
    >(
      `
      INSERT INTO products (
        product_id,
        source,
        product_name,
        avg_1d,
        avg_7d,
        avg_30d,
        last_fetched,
        is_favorite
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(product_id) DO UPDATE SET
        source = excluded.source,
        product_name = excluded.product_name,
        avg_1d = excluded.avg_1d,
        avg_7d = excluded.avg_7d,
        avg_30d = excluded.avg_30d,
        last_fetched = excluded.last_fetched,
        is_favorite = excluded.is_favorite
    `,
  );
    this.selectStmt = this.db.prepare<[string], ProductRow | undefined>(
      "SELECT * FROM products WHERE product_id = ?",
    );
    this.selectAllStmt = this.db.prepare<[], ProductRow>("SELECT * FROM products");
    this.favoriteStmt = this.db.prepare<[number, string], Database.RunResult>(
      "UPDATE products SET is_favorite = ? WHERE product_id = ?",
    );
    this.placeholderStmt = this.db.prepare<[string, string, number], Database.RunResult>(
      `
        INSERT INTO products (product_id, source, last_fetched)
        VALUES (?, ?, ?)
        ON CONFLICT(product_id) DO NOTHING
      `,
    );
  }

  public add(page: ProductPage): void {
    const productId = this.resolveProductId(page);
    if (!productId) {
      return;
    }

    const now = Date.now();
    const averages = this.extractAverages(page.priceAverages);

    const isFavorite = this.get(productId)?.favorite ? 1 : 0;
    this.upsertStmt.run(
      productId,
      page.source,
      page.productName,
      averages.average1Day,
      averages.average7Day,
      averages.average30Day,
      now,
      isFavorite,
    );
  }

  public ensurePlaceholdersForArticles(articles: ArticleItem[]): void {
    const seen = new Set<string>();
    for (const article of articles) {
      const slug = this.extractProductSlug(article.link);
      if (!slug || seen.has(slug)) {
        continue;
      }
      seen.add(slug);
      const source = `https://www.cardmarket.com/en/OnePiece/Products/${slug}`;
      this.placeholderStmt.run(slug, source, 0);
    }
  }

  public get(productId: string): ProductPage | undefined {
    const row = this.selectStmt.get(productId);
    if (!row) {
      return undefined;
    }
    return this.buildProductPage(row);
  }

  public getAll(): ProductPage[] {
    return this.selectAllStmt.all().map((row) => this.buildProductPage(row));
  }

  public setFavorite(productId: string, value: boolean): void {
    this.favoriteStmt.run(value ? 1 : 0, productId);
  }

  public remove(productId: string): boolean {
    const info = this.db.prepare("DELETE FROM products WHERE product_id = ?").run(productId);
    return info.changes > 0;
  }

  public close(): void {
    this.db.close();
  }

  private ensureSchema(): void {
    this.db.pragma("journal_mode = WAL");
    this.db.prepare(CREATE_PRODUCTS_SQL).run();
  }

  private resolveProductId(page: ProductPage): string | null {
    const slugFromSource = this.extractProductSlug(page.source);
    if (slugFromSource) {
      return slugFromSource;
    }

    const candidate = (page.productId?.trim() || page.source).trim();
    return candidate.length > 0 ? candidate : null;
  }

  private extractAverages(averages: ProductPriceAverages): ProductPriceAverages {
    return {
      average1Day: averages.average1Day ?? null,
      average7Day: averages.average7Day ?? null,
      average30Day: averages.average30Day ?? null,
    };
  }

  private extractProductSlug(link: string | null): string | null {
    if (!link) return null;
    try {
      const url = new URL(link, "https://www.cardmarket.com");
      const productsIndex = url.pathname.toLowerCase().indexOf("/products/");
      if (productsIndex === -1) {
        return null;
      }
      const slug = url.pathname.substring(productsIndex + "/products/".length);
      const normalized = slug.replace(/^\/+|\/+$/g, "");
      return normalized.length > 0 ? normalized : null;
    } catch {
      return null;
    }
  }

  private buildProductPage(row: ProductRow): ProductPage {
    return {
      source: row.source,
      productName: row.product_name,
      productId: row.product_id,
      offers: [],
      infoList: {},
      priceAverages: {
        average1Day: row.avg_1d,
        average7Day: row.avg_7d,
        average30Day: row.avg_30d,
      },
      favorite: row.is_favorite === 1,
      lastFetched: row.last_fetched,
    };
  }
}
