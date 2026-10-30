interface ImportMetaEnv {
  readonly PUBLIC_GISCUS_REPO?: string;
  readonly PUBLIC_GISCUS_REPO_ID?: string;
  readonly PUBLIC_GISCUS_CATEGORY_ID?: string;
  /** True only in the E2E build. Set by astro.config.mjs. */
  readonly E2E_FIXTURES: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
