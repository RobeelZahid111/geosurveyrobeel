import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { amIAdmin, listUsers, grantAccess, revokeAccess, type AdminUserRow } from "@/lib/admin.functions";
import { evaluateAccess } from "@/lib/subscription";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({
    meta: [
      { title: "Admin dashboard — SurveyGeoBuilder" },
      {
        name: "description",
        content:
          "Owner dashboard to review registered SurveyGeoBuilder accounts and grant or revoke free access manually.",
      },
      { property: "og:title", content: "Admin dashboard — SurveyGeoBuilder" },
      {
        property: "og:description",
        content: "Review registered accounts and manage subscription access.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

function AdminPage() {
  const navigate = useNavigate();
  const checkAdmin = useServerFn(amIAdmin);
  const fetchUsers = useServerFn(listUsers);
  const grant = useServerFn(grantAccess);
  const revoke = useServerFn(revokeAccess);

  const [state, setState] = useState<"loading" | "denied" | "ready">("loading");
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [q, setQ] = useState("");
  const [months, setMonths] = useState("1");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const data = await fetchUsers();
    setRows(data);
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        navigate({ to: "/auth" });
        return;
      }
      try {
        const { isAdmin } = await checkAdmin();
        if (!isAdmin) {
          setState("denied");
          return;
        }
        await load();
        setState("ready");
      } catch {
        setState("denied");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) => (r.email ?? "").toLowerCase().includes(s) || (r.full_name ?? "").toLowerCase().includes(s),
    );
  }, [rows, q]);

  async function doGrant(id: string) {
    setBusyId(id);
    try {
      await grant({ data: { userId: id, months: Number(months) || 1 } });
      toast.success("Access granted");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  async function doRevoke(id: string) {
    setBusyId(id);
    try {
      await revoke({ data: { userId: id } });
      toast.success("Access revoked");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  if (state === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Loading admin dashboard…
      </main>
    );
  }

  if (state === "denied") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Admin access only</CardTitle>
            <CardDescription>
              This account is not an administrator. Ask the app owner to grant you the admin role.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => navigate({ to: "/subscribe" })}>
              Back to my account
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Admin dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} registered account(s). Grant free access manually after the trial ends.
          </p>
        </header>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <Input placeholder="Search email or name…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="w-32">
            <Input
              type="number"
              min={1}
              max={120}
              value={months}
              onChange={(e) => setMonths(e.target.value)}
              aria-label="Months of free access"
            />
          </div>
          <span className="pb-2 text-xs text-muted-foreground">months granted per click</span>
        </div>

        <div className="space-y-3">
          {filtered.map((r) => {
            const access = evaluateAccess(
              r.status
                ? {
                    id: r.id,
                    user_id: r.id,
                    plan: r.plan ?? "monthly",
                    status: r.status,
                    trial_ends_at: r.trial_ends_at,
                    current_period_end: r.current_period_end,
                    provider: r.provider,
                    provider_subscription_id: null,
                  }
                : null,
            );
            return (
              <Card key={r.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
                  <div className="min-w-[200px] space-y-1">
                    <p className="font-medium text-foreground">{r.email ?? "(no email)"}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.full_name ?? "—"} · joined {fmt(r.created_at)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Trial ends {fmt(r.trial_ends_at)} · Paid until {fmt(r.current_period_end)}
                      {r.provider === "manual" ? " · manual" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {access.entitled ? (
                      <Badge>{access.reason === "trialing" ? `Trial · ${access.daysLeft}d` : `Active · ${access.daysLeft}d`}</Badge>
                    ) : (
                      <Badge variant="destructive">Expired</Badge>
                    )}
                    <Button size="sm" disabled={busyId === r.id} onClick={() => doGrant(r.id)}>
                      Give access
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === r.id}
                      onClick={() => doRevoke(r.id)}
                    >
                      Revoke
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground">No accounts match your search.</p>
          )}
        </div>
      </div>
    </main>
  );
}
