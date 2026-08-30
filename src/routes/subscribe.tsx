import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  PLAN_PRICE_LABEL,
  TRIAL_DAYS,
  evaluateAccess,
  type Access,
  type SubscriptionRow,
} from "@/lib/subscription";

export const Route = createFileRoute("/subscribe")({
  component: SubscribePage,
  head: () => ({
    meta: [
      { title: "Subscription — SurveyGeoBuilder" },
      {
        name: "description",
        content:
          "Manage your SurveyGeoBuilder subscription: 7-day free trial, then PKR 3,000 per month for full GPS survey and GeoJSON export access.",
      },
      { property: "og:title", content: "Subscription — SurveyGeoBuilder" },
      {
        property: "og:description",
        content: "7-day free trial, then PKR 3,000 per month for full survey mapping access.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const FEATURES = [
  "Draw parcels with live GPS and manual dimensions",
  "Cut, merge and divide parcels by area",
  "Undo / redo across the whole session",
  "Export vertex-point GeoJSON, single or zipped",
  "Offline-ready installable app",
];

function SubscribePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [access, setAccess] = useState<Access | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        navigate({ to: "/auth" });
        return;
      }
      const { data } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (cancelled) return;
      setEmail(session.user.email ?? null);
      setAccess(evaluateAccess(data as SubscriptionRow | null));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Loading your subscription…
      </main>
    );
  }

  const entitled = access?.entitled ?? false;

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-lg space-y-6">
        <header className="space-y-1 text-center">
          <h1 className="text-3xl font-bold text-foreground">SurveyGeoBuilder</h1>
          <p className="text-sm text-muted-foreground">{email}</p>
        </header>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Monthly plan</CardTitle>
              {entitled ? (
                <Badge>{access?.reason === "trialing" ? "Free trial" : "Active"}</Badge>
              ) : (
                <Badge variant="destructive">Inactive</Badge>
              )}
            </div>
            <CardDescription>
              {PLAN_PRICE_LABEL} · {TRIAL_DAYS}-day free trial for new accounts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-1.5 text-sm text-foreground">
              {FEATURES.map((f) => (
                <li key={f}>• {f}</li>
              ))}
            </ul>

            {entitled ? (
              <p className="text-sm text-muted-foreground">
                {access?.reason === "trialing"
                  ? `Your free trial ends in ${access.daysLeft} day(s).`
                  : `Your subscription renews in ${access?.daysLeft} day(s).`}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Your access has ended. Subscribe to keep using the survey app.
              </p>
            )}

            <div className="flex flex-col gap-2">
              {entitled && (
                <Button onClick={() => window.location.assign("/survey/index.html")}>
                  Open survey app
                </Button>
              )}
              <Button
                variant={entitled ? "outline" : "default"}
                onClick={() =>
                  toast.info(
                    "Online payment checkout is not connected yet. Contact the app owner to activate your subscription.",
                  )
                }
              >
                Subscribe — {PLAN_PRICE_LABEL}
              </Button>
              {isAdmin && (
                <Button variant="outline" onClick={() => navigate({ to: "/admin" })}>
                  Admin dashboard
                </Button>
              )}
              <Button variant="ghost" onClick={signOut}>
                Sign out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
