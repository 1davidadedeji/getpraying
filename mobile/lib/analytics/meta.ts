import type { PurchaseParams } from "./types";

function getMetaSdk() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("react-native-fbsdk-next") as typeof import("react-native-fbsdk-next");
}

export function setMetaAdvertiserTrackingEnabled(enabled: boolean): void {
  const { Settings } = getMetaSdk();
  Settings.setAdvertiserTrackingEnabled(enabled);
}

export function metaLogAppOpen(): void {
  const { AppEventsLogger } = getMetaSdk();
  AppEventsLogger.logEvent("fb_mobile_activate_app");
}

export function metaLogSignUp(method: string): void {
  const { AppEventsLogger } = getMetaSdk();
  const events = AppEventsLogger.AppEvents;
  const params = AppEventsLogger.AppEventParams;
  AppEventsLogger.logEvent(events.CompletedRegistration, {
    [params.RegistrationMethod]: method,
  });
}

export function metaLogPurchase(params: PurchaseParams): void {
  const { AppEventsLogger } = getMetaSdk();
  AppEventsLogger.logPurchase(params.value, params.currency, {
    fb_content_id: params.productId,
  });
  AppEventsLogger.logEvent("Subscribe", {
    fb_content_id: params.productId,
    _valueToSum: params.value,
    fb_currency: params.currency,
  });
}

export function metaSetUserId(id: string): void {
  const { AppEventsLogger } = getMetaSdk();
  AppEventsLogger.setUserID(id);
}
