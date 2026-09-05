import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Claude Code 스킬 번들 — 우리 소스가 아니라 린트 대상에서 뺀다.
    ".agents/**",
    ".claude/**",
  ]),
  {
    rules: {
      // 밑줄로 시작하는 이름은 "일부러 안 쓰는 값"이라는 표시로 쓴다.
      // (구조분해로 필드를 떼어낼 때, 시그니처를 맞추려고 받는 인자 등)
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
]);

export default eslintConfig;
