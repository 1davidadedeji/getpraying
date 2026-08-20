const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

/** Opt react-native-firebase out of SPM so static CocoaPods linkage works on iOS. */
function withRnFirebasePodfile(config) {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, "Podfile");
      let contents = fs.readFileSync(podfilePath, "utf8");
      const marker = "$RNFirebaseDisableSPM = true";
      if (!contents.includes(marker)) {
        contents = `${marker}\n\n${contents}`;
        fs.writeFileSync(podfilePath, contents);
      }
      return cfg;
    },
  ]);
}

module.exports = withRnFirebasePodfile;
