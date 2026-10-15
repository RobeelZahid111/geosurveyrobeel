// Regression tests: only users with an active subscription or a valid trial
// may read the mouza catalogue (public.mouza_layers) and khasra files
// (storage.objects in the 'khasra-data' bucket).
// Everything runs inside a transaction that is always rolled back.
// Run: bun test tests/rls-entitlement.test.ts
import { afterAll, describe, expect, test } from "bun:test";
import postgres from "postgres";

const url = process.env.SUPABASE_DB_URL;
const sql = url ? postgres(url, { max: 1, prepare: false }) : null;
afterAll(async () => { await sql?.end(); });

type Case = { name: string; status: string | null; trial: string | null; period: string | null; allowed: boolean };

const cases: Case[] = [
  { name: "valid trial", status: "trialing", trial: "now() + interval '3 days'", period: null, allowed: true },
  { name: "expired trial", status: "trialing", trial: "now() - interval '1 day'", period: null, allowed: false },
  { name: "active subscription", status: "active", trial: null, period: "now() + interval '30 days'", allowed: true },
  { name: "active with no end date", status: "active", trial: null, period: null, allowed: true },
  { name: "lapsed subscription", status: "active", trial: null, period: "now() - interval '1 day'", allowed: false },
  { name: "revoked / canceled", status: "canceled", trial: null, period: "now() + interval '30 days'", allowed: false },
  { name: "no subscription row", status: null, trial: null, period: null, allowed: false },
];

class Rollback extends Error {}

async function probe(c: Case | "anon") {
  let result = { mouza: -1, khasra: -1 };
  try {
    await sql!.begin(async (tx) => {
      const uid = crypto.randomUUID();
      // fixtures (as privileged role)
      await tx`insert into public.mouza_layers (tehsil, qh, mouza, mouza_id, file_path)
               values ('TestTehsil','TestQH','TestMouza','TEST-${uid}', ${"test/" + uid + ".geojson.gz"})`;
      await tx`insert into storage.objects (bucket_id, name) values ('khasra-data', ${"test/" + uid + ".geojson.gz"})`;
      if (c !== "anon") {
        await tx`insert into auth.users (id, email, aud, role) values (${uid}, ${uid + "@rls.test"}, 'authenticated', 'authenticated')`;
        // signup trigger creates a trial row; reset it to the case under test
        await tx`delete from public.subscriptions where user_id = ${uid}`;
        if (c.status) {
          await tx.unsafe(
            `insert into public.subscriptions (user_id, status, trial_ends_at, current_period_end)
             values ($1, $2, ${c.trial ?? "null"}, ${c.period ?? "null"})`,
            [uid, c.status],
          );
        }
        await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: uid, role: "authenticated" })}, true)`;
        await tx`set local role authenticated`;
      } else {
        await tx`set local role anon`;
      }
      const m = await tx`select count(*)::int as n from public.mouza_layers where tehsil = 'TestTehsil'`.catch(() => [{ n: 0 }]);
      const k = await tx`select count(*)::int as n from storage.objects where bucket_id = 'khasra-data' and name like 'test/%'`.catch(() => [{ n: 0 }]);
      result = { mouza: m[0].n, khasra: k[0].n };
      throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
  return result;
}

describe.skipIf(!sql)("mouza / khasra entitlement RLS", () => {
  test("signed-out visitor sees nothing", async () => {
    expect(await probe("anon")).toEqual({ mouza: 0, khasra: 0 });
  });
  for (const c of cases) {
    test(`${c.name} → ${c.allowed ? "allowed" : "denied"}`, async () => {
      const r = await probe(c);
      const n = c.allowed ? 1 : 0;
      expect(r).toEqual({ mouza: n, khasra: n });
    });
  }
});
