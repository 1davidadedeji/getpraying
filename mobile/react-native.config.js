const { shouldAutolinkMetaSdk } = require("./app.metaPlugin.js");

/** Facebook's native SDK crashes at launch if it is autolinked without facebook_app_id. */
const metaAutolink = shouldAutolinkMetaSdk(process.env)
  ? {}
  : {
      "react-native-fbsdk-next": {
        platforms: {
          android: null,
          ios: null,
        },
      },
    };

module.exports = {
  dependencies: metaAutolink,
};
