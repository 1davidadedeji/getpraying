/** Only show OS alerts when the user is signed in (see AuthProvider). */
let pushDeliveryEnabled = false;

export function setPushDeliveryEnabled(enabled: boolean): void {
  pushDeliveryEnabled = enabled;
}

export function isPushDeliveryEnabled(): boolean {
  return pushDeliveryEnabled;
}
