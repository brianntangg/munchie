// Backend integration tests (scripts/*.integration.ts), run by `npm run test:backend` against local Supabase.
// Plain Node environment with real fetch; Expo's Babel preset only compiles TypeScript.
const babelPresetExpo = require.resolve('babel-preset-expo', { paths: [require.resolve('expo/package.json')] });

module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/scripts/**/*.integration.ts'],
  transform: { '\\.[jt]sx?$': ['babel-jest', { presets: [babelPresetExpo] }] },
  testTimeout: 30000,
};
