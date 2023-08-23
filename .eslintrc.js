module.exports = {
  root: true,

  env: {
    node: true,
    browser: true,
  },

  extends: ["plugin:vue/essential", "eslint:recommended"],

  rules: {
    "no-console": "off",
    "no-debugger": process.env.NODE_ENV === "production" ? "error" : "off",
    "linebreak-style": ["error", "unix"],
    quotes: ["warn", "double"],
    semi: ["error", "always"],
    "no-unused-vars": "warn",
    "no-inner-declarations": "off",
    "no-undef": "error",
  },

  overrides: [
    {
      files: ["**/__tests__/*.{j,t}s?(x)"],
      env: {
        jest: true,
      },
    },
  ],
};
