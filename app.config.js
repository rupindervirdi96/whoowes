/**
 * Adds build-time settings on top of app.json.
 *
 * Android push notifications need Firebase's google-services.json. Put the file
 * in the project root, or (for EAS builds that shouldn't see it in git) upload it
 * as a "file" environment variable named GOOGLE_SERVICES_JSON. Without it the
 * app still builds; it just can't receive push notifications on Android.
 *
 * Rewarded ads (AdMob): set ADMOB_ANDROID_APP_ID / ADMOB_IOS_APP_ID (AdMob → Apps
 * → App settings, "ca-app-pub-…~…") as EAS environment variables. Until then the
 * build uses Google's sample app ids, which only ever show test ads.
 */
const fs = require('node:fs');

// Google's published sample app ids: safe for testing, never earn money.
const SAMPLE_ANDROID_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
const SAMPLE_IOS_APP_ID = 'ca-app-pub-3940256099942544~1458002511';

module.exports = ({ config }) => {
  const googleServicesFile =
    process.env.GOOGLE_SERVICES_JSON || (fs.existsSync('./google-services.json') ? './google-services.json' : undefined);
  return {
    ...config,
    android: { ...config.android, ...(googleServicesFile ? { googleServicesFile } : {}) },
    plugins: [
      ...(config.plugins ?? []),
      [
        'react-native-google-mobile-ads',
        {
          androidAppId: process.env.ADMOB_ANDROID_APP_ID || SAMPLE_ANDROID_APP_ID,
          iosAppId: process.env.ADMOB_IOS_APP_ID || SAMPLE_IOS_APP_ID,
          // Wait for the consent form before the SDK collects anything.
          delayAppMeasurementInit: true,
        },
      ],
    ],
  };
};
