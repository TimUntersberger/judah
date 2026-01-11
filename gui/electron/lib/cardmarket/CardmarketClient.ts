import fs from "node:fs/promises";
import path from "node:path";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";

export type CardmarketClientOptions = {
  homeUrl: string; // e.g. "https://www.cardmarket.com/en/OnePiece"
  loginUrl: string; // e.g. "https://www.cardmarket.com/en/OnePiece/Login"
  username: string;
  password: string;

  storageStatePath?: string; // e.g. "./cardmarket-storage.json"
  headless?: boolean; // default true
  locale?: string; // default "en-GB"
  viewport?: { width: number; height: number }; // optional
};

export class CardmarketClient {
  private readonly opts: Required<
    Omit<CardmarketClientOptions, "storageStatePath" | "viewport"> // storageStatePath + viewport handled separately
  > & {
    storageStatePath?: string;
    viewport?: { width: number; height: number };
  };

  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  constructor(options: CardmarketClientOptions) {
    if (!options.homeUrl) throw new Error("homeUrl is required");
    if (!options.loginUrl) throw new Error("loginUrl is required");
    if (!options.username) throw new Error("username is required");
    if (!options.password) throw new Error("password is required");

    this.opts = {
      homeUrl: options.homeUrl,
      loginUrl: options.loginUrl,
      username: options.username,
      password: options.password,
      headless: options.headless ?? true,
      locale: options.locale ?? "en-GB",
      storageStatePath: options.storageStatePath,
      viewport: options.viewport,
    };
  }

  /** Launch browser + create context/page. Call once before using other methods. */
  public async init(): Promise<void> {
    if (this.browser) return;

    this.browser = await chromium.launch({ headless: this.opts.headless });

    const storageState = await this.storageStateIfExists();

    console.log("Storage state path:", storageState ?? "(none)");

    this.context = await this.browser.newContext({
      locale: this.opts.locale,
      storageState: storageState ?? undefined,
      viewport: this.opts.viewport,
      userAgent: "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
      extraHTTPHeaders: {
        "Accept-Language": "en-US,en;q=0.9",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    this.page = await this.context.newPage();
  }

  /** Close everything. Safe to call multiple times. */
  public async close(): Promise<void> {
    try {
      await this.browser?.close();
    } finally {
      this.browser = null;
      this.context = null;
      this.page = null;
    }
  }

  /** Returns the underlying Playwright Page if you need to do custom actions. */
  public getPage(): Page {
    if (!this.page)
      throw new Error("CardmarketClient not initialized. Call init() first.");
    return this.page;
  }

  /** Returns true if a storage state file exists (if configured). */
  public async hasStorageState(): Promise<boolean> {
    if (!this.opts.storageStatePath) return false;
    return this.fileExists(this.opts.storageStatePath);
  }

  /**
   * Logs in only if there is no storageState file.
   * After login, saves storageState (if storageStatePath is provided).
   */
  public async loginIfNeeded(): Promise<void> {
    this.ensureReady();

    console.log("Starting login...");
    // Only skip login if a storage file exists AND we loaded it.
    // This matches your earlier requirement (simple “if file exists => skip login”).
    if (await this.hasStorageState()) return;

    const page = this.page!;

    console.log("Redirecting to login page...");
    // Your working login flow (kept intact)
    await page.goto(this.opts.loginUrl, { waitUntil: "domcontentloaded" });

    await page.screenshot({ path: "before-login.png" });

    const usernameInput = await page.waitForSelector("input[name='username']", {
      timeout: 10000,
    });
    const passwordInput = await page.waitForSelector(
      "input[name='userPassword']",
      { timeout: 10000 }
    );
    const submitInput = await page.waitForSelector("input[type='submit']", {
      timeout: 10000,
    });

    console.log("Filling login form...");
    await usernameInput.fill(this.opts.username);
    await passwordInput.fill(this.opts.password);

    console.log("Waiting a bit before submitting...");
    await page.waitForTimeout(Math.random() * 1000);

    console.log("Submitting login form...");
    await submitInput.focus();
    await submitInput.press("Enter");

    console.log("Waiting for navigation after login...");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);

    await this.saveStorageState();
  }

  /**
   * Ensures we are authenticated. Calls {@link loginIfNeeded}, then navigates to the home page
   * and retries the login if we still see the login form (e.g. stale storage state).
   */
  public async ensureLoggedIn(): Promise<void> {
    this.ensureReady();

    await this.loginIfNeeded();
    await this.gotoHome();

    if (await this.isOnLoginPage()) {
      await this.clearStorageStateFile();
      await this.loginIfNeeded();
      await this.gotoHome();
    }
  }

  /** Navigate to any URL and return the full HTML string (page.content()). */
  public async fetchHtml(url: string): Promise<string> {
    this.ensureReady();

    const page = this.page!;
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(250);
    return await page.content();
  }

  /** Convenience: go to home page (no return). */
  public async gotoHome(): Promise<void> {
    this.ensureReady();
    await this.page!.goto(this.opts.homeUrl, { waitUntil: "domcontentloaded" });
  }

  public async gotoUrl(url: string): Promise<void> {
    this.ensureReady();
    await this.page!.goto(url, { waitUntil: "domcontentloaded" });
  }

  /** Save storageState to disk (if storageStatePath was provided). */
  public async saveStorageState(): Promise<void> {
    this.ensureReady();
    console.log("Saving storage state...");
    if (!this.opts.storageStatePath) return;
    await this.context!.storageState({ path: this.opts.storageStatePath });
  }

  // ----------------- internals -----------------

  private ensureReady(): void {
    if (!this.browser || !this.context || !this.page) {
      throw new Error("CardmarketClient not initialized. Call init() first.");
    }
  }

  private async storageStateIfExists(): Promise<string | null> {
    if (!this.opts.storageStatePath) return null;
    const p = path.resolve(process.cwd(), this.opts.storageStatePath);
    return (await this.fileExists(p)) ? p : null;
  }

  private async fileExists(p: string): Promise<boolean> {
    try {
      await fs.access(p);
      return true;
    } catch {
      return false;
    }
  }

  private async isOnLoginPage(): Promise<boolean> {
    if (!this.page) return true;
    try {
      await this.page.waitForSelector("input[name='username']", {
        timeout: 2000,
      });
      return true;
    } catch {
      return false;
    }
  }

  private async clearStorageStateFile(): Promise<void> {
    if (!this.opts.storageStatePath) return;
    const resolved = path.resolve(process.cwd(), this.opts.storageStatePath);
    try {
      await fs.unlink(resolved);
    } catch {
      // ignore missing file
    }
  }
}
