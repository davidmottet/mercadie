import globals from "globals";
import pluginJs from "@eslint/js";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    languageOptions: { globals: globals.browser },
    rules: {
      "indent": ["error", 2],
      "no-trailing-spaces": "error",
      "space-before-function-paren": ["error", "always"],
      "comma-spacing": ["error", { "before": false, "after": true }],
    },
  },
  pluginJs.configs.recommended,
];