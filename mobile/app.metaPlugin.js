const META_DUMMY_APP_ID = "123456789012345";

function isPlaceholderMetaAppId(appId) {
  const value = String(appId ?? "").trim();
  if (!/^\d{8,}$/.test(value)) return true;
  return value === META_DUMMY_APP_ID;
}

function isPlaceholderMetaClientToken(token) {
  const value = String(token ?? "").trim();
  if (value.length < 8) return true;
  return /dummy|placeholder|replace_before|replace me/i.test(value);
}

function metaPluginFromEnv(env) {
  const appID = String(env?.EXPO_PUBLIC_META_APP_ID ?? "").trim();
  const clientToken = String(env?.EXPO_PUBLIC_META_CLIENT_TOKEN ?? "").trim();
  if (isPlaceholderMetaAppId(appID) || isPlaceholderMetaClientToken(clientToken)) {
    return [];
  }
  return [
    [
      "react-native-fbsdk-next",
      {
        appID,
        clientToken,
        displayName: "Get Praying",
        scheme: `fb${appID}`,
        advertiserIDCollectionEnabled: true,
        autoLogAppEventsEnabled: true,
        iosUserTrackingPermission:
          "This allows us to optimize your experience and measure ad performance.",
      },
    ],
  ];
}

module.exports = {
  isPlaceholderMetaAppId,
  isPlaceholderMetaClientToken,
  metaPluginFromEnv,
};
