import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ADMIN_EMAIL = "robeelzahid111@gmail.com";

async function hasAdminRole(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error("Could not verify admin role");
  return Boolean(data);
}

async function assertAdmin(context: { supabase: any; userId: string }) {
  const isAdminRole = await hasAdminRole(context);

  const { data: user, error: userError } = await context.supabase
    .from("profiles")
    .select("email")
    .eq("id", context.userId)
    .single();
  if (userError) throw new Error("Could not verify admin email");

  if (!isAdminRole || user?.email !== ADMIN_EMAIL) {
    throw new Error("Forbidden");
  }
}

export type AdminUserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  plan: string | null;
  status: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  provider: string | null;
};

export const amIAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const isAdminRole = await hasAdminRole(context).catch(() => false);

    const { data: user } = await context.supabase
      .from("profiles")
      .select("email")
      .eq("id", context.userId)
      .single();

    return { isAdmin: isAdminRole && user?.email === ADMIN_EMAIL };
  });

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminUserRow[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const { data: subs } = await supabaseAdmin
      .from("subscriptions")
      .select("user_id, plan, status, trial_ends_at, current_period_end, provider");

    const byUser = new Map((subs ?? []).map((s) => [s.user_id, s]));

    return (profiles ?? []).map((p) => {
      const s = byUser.get(p.id);
      return {
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        created_at: p.created_at,
        plan: s?.plan ?? null,
        status: s?.status ?? null,
        trial_ends_at: s?.trial_ends_at ?? null,
        current_period_end: s?.current_period_end ?? null,
        provider: s?.provider ?? null,
      };
    });
  });

export const grantAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; months: number }) => {
    if (!input?.userId) throw new Error("userId required");
    const months = Number(input.months);
    if (!Number.isFinite(months) || months < 1 || months > 120) {
      throw new Error("months must be between 1 and 120");
    }
    return { userId: input.userId, months };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const end = new Date();
    end.setMonth(end.getMonth() + data.months);

    const { error } = await supabaseAdmin.from("subscriptions").upsert(
      {
        user_id: data.userId,
        plan: "monthly",
        status: "active",
        current_period_end: end.toISOString(),
        provider: "manual",
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true, current_period_end: end.toISOString() };
  });

export const revokeAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => {
    if (!input?.userId) throw new Error("userId required");
    return { userId: input.userId };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("subscriptions")
      .update({
        status: "canceled",
        current_period_end: new Date().toISOString(),
        trial_ends_at: null,
      })
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
