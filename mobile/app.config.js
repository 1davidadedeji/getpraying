const appJson = require("./app.json");
const { metaPluginFromEnv } = require("./app.metaPlugin.js");

function pluginName(plugin) {
  return Array.isArray(plugin) ? plugin[0] : plugin;
}

const plugins = (appJson.expo.plugins ?? []).filter(
  (plugin) => pluginName(plugin) !== "react-native-fbsdk-next",
);

module.exports = {
  ...appJson.expo,
  plugins: [...plugins, ...metaPluginFromEnv(process.env)],
};
