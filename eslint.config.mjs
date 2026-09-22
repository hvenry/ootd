import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "worker/**",
      "storage/**",
      "src/db/migrations/**",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    rules: {
      // Garment photographs are served as plain <img> on purpose. next/image
      // re-encodes, the measure screen reads the mask off these exact pixels,
      // and on glibc Linux sharp can balloon memory optimising 12MP files.
      // The design system also wants the natural aspect ratio, never a crop.
      "@next/next/no-img-element": "off",
    },
  },
];

export default eslintConfig;
