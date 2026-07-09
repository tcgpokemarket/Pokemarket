import nextConfig from "eslint-config-next";

const config = [
  ...nextConfig,
  {
    rules: {
      "@next/next/no-html-link-for-pages": "off",
      "@next/next/no-img-element": "off",
      "@next/next/no-page-custom-font": "off",
      "react-hooks/exhaustive-deps": "off",
      "import/no-anonymous-default-export": "off",
    },
    ignores: [".next/**", "out/**", "node_modules/**"],
  },
];

export default config;
