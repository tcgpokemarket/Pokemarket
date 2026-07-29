type EnvMap = Record<string, string | undefined>;

function readEnvValue(env: EnvMap, key: string) {
  return env[key]?.trim() ?? "";
}

export function requireEnv(key: string, label = key, env: EnvMap = process.env) {
  const value = readEnvValue(env, key);
  if (!value) {
    throw new Error(`${label} is not configured.`);
  }

  return value;
}

export function requireAnyEnv(keys: string[], label: string, env: EnvMap = process.env) {
  for (const key of keys) {
    const value = readEnvValue(env, key);
    if (value) return value;
  }

  throw new Error(`${label} is not configured.`);
}

export function requireEnvSet(keys: string[], label: string, env: EnvMap = process.env) {
  const values: Record<string, string> = {};
  const missing: string[] = [];

  for (const key of keys) {
    const value = readEnvValue(env, key);
    if (value) {
      values[key] = value;
    } else {
      missing.push(key);
    }
  }

  if (missing.length) {
    throw new Error(`${label} is not configured. Missing: ${missing.join(", ")}.`);
  }

  return values;
}

export function getEnvironmentAudit(env: EnvMap = process.env) {
  const groups = [
    {
      name: "Supabase",
      required: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
      optional: [],
    },
    {
      name: "Stripe",
      required: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
      optional: ["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"],
    },
    {
      name: "LiveKit",
      required: ["NEXT_PUBLIC_LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"],
      optional: [],
    },
    {
      name: "Cloudinary",
      required: ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"],
      optional: [],
    },
    {
      name: "OpenAI / Scanner",
      required: ["OPENAI_API_KEY"],
      optional: ["OPENAI_CARD_MODEL", "CARD_INGESTION_STORAGE_BUCKET"],
    },
    {
      name: "Pokémon pricing",
      required: [],
      optional: ["POKEMON_TCG_API_KEY", "POKEMON_TCG_API_TOKEN", "TCGPLAYER_API_KEY", "TCGPLAYER_API_SECRET", "EBAY_APP_ID"],
    },
    {
      name: "USPS shipping",
      required: ["USPS_LABELS_URL"],
      optional: ["USPS_PAYMENT_AUTHORIZATION_TOKEN", "USPS_PAYMENT_AUTH_TOKEN"],
    },
    {
      name: "Site",
      required: ["NEXT_PUBLIC_SITE_URL"],
      optional: ["ADMIN_EMAILS", "CARD_INGESTION_STORAGE_BUCKET"],
    },
  ] as const;

  return groups.map((group) => {
    const missingRequired = group.required.filter((key) => !readEnvValue(env, key));
    const missingOptional = group.optional.filter((key) => !readEnvValue(env, key));

    return {
      name: group.name,
      configured: missingRequired.length === 0,
      required: group.required,
      optional: group.optional,
      missingRequired,
      missingOptional,
    };
  });
}

export function formatEnvironmentAudit(env: EnvMap = process.env) {
  return getEnvironmentAudit(env)
    .map((group) => {
      const required = group.required.length ? group.required.join(", ") : "none";
      const optional = group.optional.length ? group.optional.join(", ") : "none";
      const status = group.configured ? "configured" : "missing";
      return `${group.name}: ${status} | required: ${required} | optional: ${optional}`;
    })
    .join("\n");
}

const CRITICAL_ENVIRONMENTS = [
  {
    name: "Supabase",
    keys: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
  },
  {
    name: "Stripe",
    keys: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
  },
  {
    name: "Site",
    keys: ["NEXT_PUBLIC_SITE_URL"],
  },
] as const;

export function assertRequiredEnvironment(env: EnvMap = process.env) {
  const missing = CRITICAL_ENVIRONMENTS.flatMap((group) =>
    group.keys.filter((key) => !readEnvValue(env, key)).map((key) => `${group.name}: ${key}`),
  );

  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

export function getCriticalEnvironmentAudit(env: EnvMap = process.env) {
  return CRITICAL_ENVIRONMENTS.map((group) => ({
    name: group.name,
    missing: group.keys.filter((key) => !readEnvValue(env, key)),
  }));
}
