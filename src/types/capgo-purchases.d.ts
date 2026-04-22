declare module '@capgo/capacitor-purchases' {
  export const Purchases: {
    configure(opts: { apiKey: string }): Promise<void>;
    getCustomerInfo(): Promise<{ customerInfo: any }>;
    purchaseProduct(opts: { productIdentifier: string }): Promise<{ customerInfo: any }>;
    restorePurchases(): Promise<{ customerInfo: any }>;
  };
}
