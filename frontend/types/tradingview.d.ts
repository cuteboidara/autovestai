export {};

declare global {
  interface Window {
    TradingView?: {
      widget: new (options: Record<string, unknown>) => {
        remove?: () => void;
      };
    };
  }
}
