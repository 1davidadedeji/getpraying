type FirebaseAnalytics = {
  setAnalyticsCollectionEnabled: (enabled: boolean) => Promise<void>;
  logAppOpen: () => Promise<void>;
  logSignUp: (params: { method: string }) => Promise<void>;
  logPurchase: (params: {
    value: number;
    currency: string;
    items: { item_id: string }[];
  }) => Promise<void>;
  setUserId: (id: string) => Promise<void>;
};

function analytics(): FirebaseAnalytics {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const factory = require("@react-native-firebase/analytics").default as () => FirebaseAnalytics;
  return factory();
}

export async function enableFirebaseCollection(): Promise<void> {
  await analytics().setAnalyticsCollectionEnabled(true);
}

export async function firebaseLogAppOpen(): Promise<void> {
  await analytics().logAppOpen();
}

export async function firebaseLogSignUp(method: string): Promise<void> {
  await analytics().logSignUp({ method });
}

export async function firebaseLogPurchase(params: {
  productId: string;
  value: number;
  currency: string;
}): Promise<void> {
  await analytics().logPurchase({
    value: params.value,
    currency: params.currency,
    items: [{ item_id: params.productId }],
  });
}

export async function firebaseSetUserId(id: string): Promise<void> {
  await analytics().setUserId(id);
}
