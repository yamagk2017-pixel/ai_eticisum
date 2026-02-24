type SanityEnvValues = {
  projectId: string;
  dataset: string;
  apiVersion: string;
};

function readEnvValue(value: string | undefined): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function hasSanityStudioEnv() {
  return Boolean(
    readEnvValue(process.env.NEXT_PUBLIC_SANITY_PROJECT_ID) &&
      readEnvValue(process.env.NEXT_PUBLIC_SANITY_DATASET)
  );
}

export function getSanityConfigValues(): SanityEnvValues {
  return {
    projectId:
      readEnvValue(process.env.NEXT_PUBLIC_SANITY_PROJECT_ID) ?? "missing-sanity-project-id",
    dataset: readEnvValue(process.env.NEXT_PUBLIC_SANITY_DATASET) ?? "production",
    apiVersion: readEnvValue(process.env.NEXT_PUBLIC_SANITY_API_VERSION) ?? "2026-02-24",
  };
}
