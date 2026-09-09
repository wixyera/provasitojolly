import { env } from "cloudflare:workers";

const DEFAULT_URL = "https://xwgzxdpamsleleliatjc.supabase.co";
const DEFAULT_PUBLISHABLE_KEY = "sb_publishable_DjolDQ0HWJtwoR6tRZWSaA_zPP4xFqb";

export class RouteError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Bindings = Record<string, unknown>;
type SupabaseConfig = { url: string; publishableKey: string; secretKey: string };
type User = { id: string; email?: string };

function bindings() {
  return env as unknown as Bindings;
}

function binding(name: string, fallback = "") {
  const value = bindings()[name];
  return typeof value === "string" ? value : fallback;
}

export function supabaseConfig(): SupabaseConfig {
  return {
    url: binding("SUPABASE_URL", DEFAULT_URL).replace(/\/$/, ""),
    publishableKey: binding("SUPABASE_PUBLISHABLE_KEY", binding("SUPABASE_ANON_KEY", DEFAULT_PUBLISHABLE_KEY)),
    secretKey: binding("SUPABASE_SECRET_KEY", binding("SUPABASE_SERVICE_ROLE_KEY")),
  };
}

export function requiredSecret(name: string) {
  const value = binding(name, name === "SUPABASE_SECRET_KEY" ? binding("SUPABASE_SERVICE_ROLE_KEY") : "");
  if (!value) throw new RouteError(503, `Configurazione server mancante: ${name}.`);
  return value;
}

export function bearer(request: Request) {
  const value = request.headers.get("authorization") || "";
  if (!/^Bearer\s+\S+$/i.test(value)) throw new RouteError(401, "Accesso richiesto.");
  return value.replace(/^Bearer\s+/i, "").trim();
}

function apiHeaders(key: string, extra?: HeadersInit) {
  const headers = new Headers(extra);
  headers.set("apikey", key);
  if (!headers.has("Authorization") && !/^sb_(publishable|secret)_/.test(key)) headers.set("Authorization", `Bearer ${key}`);
  return headers;
}

export async function supabaseFetch<T = unknown>(config: SupabaseConfig, path: string, options: RequestInit = {}, key = config.secretKey || config.publishableKey): Promise<T> {
  const headers = apiHeaders(key, options.headers);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${config.url}${path}`, { ...options, headers });
  const text = await response.text();
  let data: unknown = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
  if (!response.ok) {
    const record = data as Record<string, unknown>;
    throw new RouteError(response.status >= 500 ? 502 : response.status, String(record.msg || record.message || record.error_description || record.error || "Richiesta Supabase non riuscita."));
  }
  return data as T;
}

export async function currentUser(request: Request) {
  const config = supabaseConfig();
  const token = bearer(request);
  const user = await supabaseFetch<User>(config, "/auth/v1/user", { headers: { Authorization: `Bearer ${token}` } }, config.publishableKey);
  if (!user?.id) throw new RouteError(401, "Sessione non valida. Accedi di nuovo.");
  const rows = await supabaseFetch<Array<{ role: string; is_blocked: boolean }>>(config, `/rest/v1/profiles?select=role,is_blocked&id=eq.${encodeURIComponent(user.id)}`, { headers: { Authorization: `Bearer ${token}` } }, config.publishableKey);
  const profile = rows[0];
  if (!profile || profile.is_blocked) throw new RouteError(403, "Account sospeso o profilo non disponibile.");
  return { config, token, user, profile };
}

export async function staffUser(request: Request) {
  const context = await currentUser(request);
  if (context.profile.role !== "staff") throw new RouteError(403, "Operazione riservata allo staff.");
  if (!context.config.secretKey) throw new RouteError(503, "Configura il secret Supabase nei Worker secrets prima di usare questa funzione.");
  return context;
}

export function jsonError(error: unknown) {
  const status = error instanceof RouteError ? error.status : 500;
  const message = error instanceof Error ? error.message : "Operazione non riuscita.";
  return Response.json({ error: message.slice(0, 350) }, { status });
}
