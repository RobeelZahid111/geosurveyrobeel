// Regression tests: only users with an active subscription or a valid trial
// may read the mouza catalogue (public.mouza_layers) and khasra files
// (private 'khasra-data' storage bucket).
// Creates throwaway users + fixtures with the service role, checks access as
// each user through the real API, then deletes everything.
// Run: bun test ./tests/rls-entitlement.test.ts
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
const enabled = Boolean(URL && SERVICE && ANON);

const day = 86_400_000;
const iso = (ms: number) => new Date(Date.now() + ms).toISOString();

type Case = { name: string; sub: Record<string, unknown> | null; allowed: boolean };
const cases: Case[] = [
  { name: "valid trial", sub: { status: "trialing", trial_ends_at: iso(3 * day), current_period_end: null }, allowed: true },
  { name: "expired trial", sub: { status: "trialing", trial_ends_at: iso(-day), current_period_end: null }, allowed: false },
  { name: "active subscription", sub: { status: "active", trial_ends_at: null, current_period_end: iso(30 * day) }, allowed: true },
  { name: "active with no end date", sub: { status: "active", trial_ends_at: null, current_period_end: null }, allowed: true },
  { name: "lapsed subscription", sub: { status: "active", trial_ends_at: null, current_period_end: iso(-day) }, allowed: false },
  { name: "revoked / canceled", sub: { status: "canceled", trial_ends_at: null, current_period_end: iso(30 * day) }, allowed: false },
  { name: "no subscription row", sub: null, allowed: false },
];

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
let admin: SupabaseClient;
const tag = `rls-test-${crypto.randomUUID().slice(0, 8)}`;
const filePath = `__rls_test__/${tag}.geojson.gz`;
const userIds: string[] = [];
const password = `Pw-${crypto.randomUUID()}`;

async function makeUser(c: Case) {
  const email = `${tag}-${userIds.length}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const id = data.user!.id;
  userIds.push(id);
  // signup trigger inserts a trial row; overwrite or remove it for this case
  if (c.sub) {
    const { error: e } = await admin.from("subscriptions").update(c.sub).eq("user_id", id);
    if (e) throw e;
  } else {
    await admin.from("subscriptions").delete().eq("user_id", id);
  }
  const client = createClient(URL!, ANON!, opts);
  const { error: se } = await client.auth.signInWithPassword({ email, password });
  if (se) throw se;
  return client;
}

async function access(client: SupabaseClient) {
  const { data: rows } = await client.from("mouza_layers").select("id").eq("mouza_id", tag);
  const { data: file } = await client.storage.from("khasra-data").download(filePath);
  return { mouza: rows?.length ?? 0, khasra: file ? 1 : 0 };
}

describe.skipIf(!enabled)("mouza / khasra entitlement RLS", () => {
  beforeAll(async () => {
    admin = createClient(URL!, SERVICE!, opts);
    const { error: e1 } = await admin.from("mouza_layers").insert({ tehsil: "RLS Test", qh: "RLS Test", mouza: tag, mouza_id: tag, file_path: filePath });
    if (e1) throw e1;
    const { error: e2 } = await admin.storage.from("khasra-data").upload(filePath, new Blob(["test"]), { upsert: true });
    if (e2) throw e2;
  });

  afterAll(async () => {
    await admin.from("mouza_layers").delete().eq("mouza_id", tag);
    await admin.storage.from("khasra-data").remove([filePath]);
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  });

  test("signed-out visitor sees nothing", async () => {
    expect(await access(createClient(URL!, ANON!, opts))).toEqual({ mouza: 0, khasra: 0 });
  });

  for (const c of cases) {
    test(`${c.name} → ${c.allowed ? "allowed" : "denied"}`, async () => {
      const n = c.allowed ? 1 : 0;
      expect(await access(await makeUser(c))).toEqual({ mouza: n, khasra: n });
    }, 20_000);
  }
});
