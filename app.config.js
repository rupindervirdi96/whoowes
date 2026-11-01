/**
 * Adds build-time settings on top of app.json.
 *
 * Android push notifications need Firebase's google-services.json. Put the file
 * in the project root, or (for EAS builds that shouldn't see it in git) upload it
 * as a "file" environment variable named GOOGLE_SERVICES_JSON. Without it the
 * app still builds; it just can't receive push notifications on Android.
 */
const fs = require('node:fs');

module.exports = ({ config }) => {
  const googleServicesFile =
    process.env.GOOGLE_SERVICES_JSON || (fs.existsSync('./google-services.json') ? './google-services.json' : undefined);
  return {
    ...config,
    android: { ...config.android, ...(googleServicesFile ? { googleServicesFile } : {}) },
  };
};
