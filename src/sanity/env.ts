type SanityEnvValues = {
  projectId: string;
  dataset: string;
  apiVersion: string;
};

function readEnv(name: string): string | null {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function hasSanityStudioEnv() {
  return Boolean(readEnv("NEXT_PUBLIC_SANITY_PROJECT_ID") && readEnv("NEXT_PUBLIC_SANITY_DATASET"));
}

export function getSanityConfigValues(): SanityEnvValues {
  return {
    projectId: readEnv("NEXT_PUBLIC_SANITY_PROJECT_ID") ?? "MISSING_SANITY_PROJECT_ID",
    dataset: readEnv("NEXT_PUBLIC_SANITY_DATASET") ?? "production",
    apiVersion: readEnv("NEXT_PUBLIC_SANITY_API_VERSION") ?? "2026-02-24",
  };
}
