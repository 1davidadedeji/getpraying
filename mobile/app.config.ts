import appJson from "./app.json";
import { metaPluginFromEnv, type ExpoPluginEntry } from "./lib/vendorPlaceholders";

function pluginName(plugin: ExpoPluginEntry): string {
  return Array.isArray(plugin) ? plugin[0] : plugin;
}

const plugins = ((appJson.expo.plugins ?? []) as ExpoPluginEntry[]).filter(
  (plugin) => pluginName(plugin) !== "react-native-fbsdk-next",
);

export default {
  ...appJson.expo,
  plugins: [...plugins, ...metaPluginFromEnv(process.env)],
};
