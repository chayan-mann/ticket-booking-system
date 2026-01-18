// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      "prettier/prettier": "off",
      "unused-imports/no-unused-imports": "warn",
      "unused-imports/no-unused-vars": "off",
      "unused-imports/no-unused-vars-ts": "off",
      "unused-imports/no-unused-vars-tsx": "off",
      "unused-imports/no-unused-vars-jsx": "off",
      "unused-imports/no-unused-vars-json": "off",
      "unused-imports/no-unused-vars-css": "off",
      "unused-imports/no-unused-vars-html": "off",
      "unused-imports/no-unused-vars-md": "off",
    },
  },
);
