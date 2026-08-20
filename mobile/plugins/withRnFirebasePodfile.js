const { withDangerousMod, IOSConfig } = require("@expo/config-plugins");
const fs = require("fs");

const PODFILE_MARKERS = ["$RNFirebaseDisableSPM = true"];

/** Opt react-native-firebase out of SPM so static CocoaPods linkage works on iOS. */
function patchPodfile(contents) {
  let next = contents;
  for (const marker of PODFILE_MARKERS) {
    if (!next.includes(marker)) {
      next = `${marker}\n\n${next}`;
    }
  }
  return next;
}

/** Avoid startup crash if Firebase is configured more than once. */
function patchAppDelegate(contents) {
  const guarded = `if FirebaseApp.app() == nil {
  FirebaseApp.configure()
}`;
  if (contents.includes(guarded)) return contents;
  return contents.replace(/FirebaseApp\.configure\(\)/g, guarded);
}

function withRnFirebasePodfile(config) {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const root = cfg.modRequest.projectRoot;
      const podfilePath = IOSConfig.Paths.getPodfilePath(root);
      const podfile = fs.readFileSync(podfilePath, "utf8");
      const patchedPodfile = patchPodfile(podfile);
      if (patchedPodfile !== podfile) {
        fs.writeFileSync(podfilePath, patchedPodfile);
      }

      const appDelegate = IOSConfig.Paths.getAppDelegate(root);
      const patchedDelegate = patchAppDelegate(appDelegate.contents);
      if (patchedDelegate !== appDelegate.contents) {
        await fs.promises.writeFile(appDelegate.path, patchedDelegate);
      }

      return cfg;
    },
  ]);
}

module.exports = withRnFirebasePodfile;
