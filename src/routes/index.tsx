import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/survey-geo-logo.jpg.asset.json";
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
  const [starting, setStarting] = useState(false);
  async function startSurvey() {
    setStarting(true);
      try {
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
        if (evaluateAccess(data as SubscriptionRow | null).entitled) {
          window.location.assign("/survey/index.html?start=1");
        } else {
          navigate({ to: "/subscribe" });
        }
      } catch {
        navigate({ to: "/subscribe" });
      } finally {
        setStarting(false);
      }
  }

  return (
    <main className="survey-welcome-page">
      <div className="survey-welcome-content">
        <img className="survey-welcome-logo" src={logo.url} alt="Survey Geo — Precision. Geospatial. Mapping." />
        <h1>Welcome to Survey Geo</h1>
        <Button className="survey-start-button" size="lg" onClick={startSurvey} disabled={starting}>
          {starting ? <LoaderCircle className="animate-spin" /> : null}
          {starting ? "Opening survey…" : "Start Survey"}
          {!starting ? <ArrowRight /> : null}
        </Button>
      </div>
    </main>
  );
}
