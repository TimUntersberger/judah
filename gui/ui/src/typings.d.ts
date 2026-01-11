export {};

declare global {
  interface Window {
    api: {
      readDb: () => Promise<unknown>;
    };
  }
}
