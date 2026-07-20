const { expo } = require('./app.json');

// google-services.json is untracked (see .gitignore) and never committed —
// EAS Build injects it from the project's GOOGLE_SERVICES_JSON file secret
// (env var resolves to the downloaded secret's path on the builder). Local
// builds fall back to the real file sitting untracked at the repo root; see
// google-services.json.example for the expected shape.
module.exports = {
  expo: {
    ...expo,
    android: {
      ...expo.android,
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
    },
  },
};
