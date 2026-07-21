import tsParser from "@typescript-eslint/parser";
export default [{
    files: ["src/**/*.ts"],
    languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 2020, sourceType: "module" } },
    rules: { "powerbi-visuals/no-inner-outer-html": "off", "@typescript-eslint/no-explicit-any": "off" }
}];
