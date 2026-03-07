import { createClient } from "@supabase/supabase-js";

type CreateServerClientOptions = {
  requireServiceRole?: boolean;
};

export function createServerClient(options?: CreateServerClientOptions) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (options?.requireServiceRole) {
    if (!serviceRoleKey) {
      throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
    }
    if (serviceRoleKey.startsWith("sb_publishable_")) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is publishable key");
    }

    // Legacy JWT keys can be decoded; require `role=service_role`.
    if (serviceRoleKey.startsWith("eyJ")) {
      const parts = serviceRoleKey.split(".");
      if (parts.length >= 2) {
        try {
          const payload = JSON.parse(
            Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
          ) as { role?: string };
          if (payload.role && payload.role !== "service_role") {
            throw new Error("SUPABASE_SERVICE_ROLE_KEY role is not service_role");
          }
        } catch (error) {
          if (error instanceof Error && error.message.includes("role is not service_role")) {
            throw error;
          }
        }
      }
    }
  }
  const key = serviceRoleKey || publishableKey;

  if (!url || !key) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
