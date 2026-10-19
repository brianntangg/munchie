// Extends app.json. EXPO_BASE_URL serves the web export from a subpath; CI sets it
// to /munchie for GitHub Pages. Local development and the release build use the root.
module.exports = ({ config }) => ({
  ...config,
  experiments: { ...config.experiments, baseUrl: process.env.EXPO_BASE_URL || undefined },
});
