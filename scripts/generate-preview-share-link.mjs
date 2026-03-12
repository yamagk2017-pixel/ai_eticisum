#!/usr/bin/env node

function parseArgs(argv) {
  const out = {
    path: "",
    ttlMinutes: 60 * 24 * 5,
    origin: process.env.PREVIEW_SHARE_ORIGIN || "https://www.musicite.net",
    secret: process.env.PREVIEW_SHARE_SECRET || "",
  };

  for (const arg of argv) {
    if (arg.startsWith("--path=")) out.path = arg.slice("--path=".length);
    else if (arg.startsWith("--ttlMinutes=")) out.ttlMinutes = Number(arg.slice("--ttlMinutes=".length));
    else if (arg.startsWith("--origin=")) out.origin = arg.slice("--origin=".length);
    else if (arg.startsWith("--secret=")) out.secret = arg.slice("--secret=".length);
  }

  return out;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options.path || !options.path.startsWith("/")) {
    fail("Missing or invalid --path. Example: --path=/news/musicite-idol-crossing");
  }
  if (!options.secret) {
    fail("Missing PREVIEW_SHARE_SECRET or --secret.");
  }
  if (!Number.isFinite(options.ttlMinutes) || options.ttlMinutes <= 0) {
    fail("Invalid --ttlMinutes.");
  }

  const endpoint = new URL("/api/draft/share-link", options.origin);
  endpoint.searchParams.set("secret", options.secret);
  endpoint.searchParams.set("path", options.path);
  endpoint.searchParams.set("ttlMinutes", String(Math.trunc(options.ttlMinutes)));

  const response = await fetch(endpoint);
  const text = await response.text();

  if (!response.ok) {
    fail(`Failed (${response.status}): ${text}`);
  }

  const json = JSON.parse(text);
  console.log(json.previewUrl);
  console.log(`expiresAt=${json.expiresAt}`);
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));

