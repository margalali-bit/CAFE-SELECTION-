module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    ...(process.env.GOOGLE_SERVICES_JSON_PATH
      ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON_PATH }
      : {}),
  },
  extra: {
    ...config.extra,
    eas: { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || "" },
  },
});
