module.exports = {
  root: true,

  env: {
    node: true,
    browser: true,
  },
  extends: ["plugin:vue/essential", "eslint:recommended", "@vue/typescript"],

  rules: {
    "no-console": process.env.NODE_ENV === "production" ? "error" : "off",
    "no-debugger": process.env.NODE_ENV === "production" ? "error" : "off",

    "linebreak-style": ["error", "unix"],
    quotes: ["warn", "double"],
    semi: ["error", "always"],

    "one-var-declaration-per-line": ["error", "initializations"],
    "no-inner-declarations": "off",
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": "error",
  },

  // parserOptions: {
  //   parser: "babel-eslint",
  // },

  overrides: [
    {
      files: ["**/__tests__/*.{j,t}s?(x)"],
      env: {
        jest: true,
      },
    },
  ],
};
