const { defineConfig } = require('eslint/config');
const expo = require('eslint-config-expo/flat');
module.exports = defineConfig([
  expo,
  { ignores: ['dist/**', 'src/lib/database.types.ts'] },
  // Screens under the Munchie header must not add the notch inset again; the wrapper handles that.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/components/SafeArea.tsx'],
    rules: {
      // Covers named, renamed and namespace imports (* as) of SafeAreaView from both packages that export one.
      'no-restricted-imports': ['error', { paths: ['react-native-safe-area-context', 'react-native'].map((name) => ({ name, importNames: ['SafeAreaView'], message: "Import SafeAreaView from '@/components/SafeArea' so screens under a header don't add the top inset twice." })) }],
    },
  },
]);
