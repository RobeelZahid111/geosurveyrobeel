import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { evaluateAccess, type SubscriptionRow } from "@/lib/subscription";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "SurveyGeoBuilder — GPS Parcel Survey & GeoJSON Export" },
      {
        name: "description",
        content:
          "Draw, cut, merge and divide land parcels with live GPS, then export WGS84 vertex-point GeoJSON. Subscription with a 7-day free trial.",
      },
      { property: "og:title", content: "SurveyGeoBuilder — GPS Parcel Survey & GeoJSON Export" },
      {
        property: "og:description",
        content: "Field survey mapping with parcel cutting, area division and GeoJSON export.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData.session;
        if (cancelled) return;
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
        if (evaluateAccess(data as SubscriptionRow | null).entitled) {
          window.location.replace("/survey/index.html");
        } else {
          navigate({ to: "/subscribe" });
        }
      } catch {
        if (!cancelled) navigate({ to: "/subscribe" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
      Loading SurveyGeoBuilder…
    </main>
  );
}
