export type SubscriptionRow = {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  provider: string | null;
  provider_subscription_id: string | null;
};

export type Access = {
  entitled: boolean;
  reason: "active" | "trialing" | "expired" | "none";
  daysLeft: number;
};

export const PLAN_PRICE_LABEL = "PKR 3,000 / month";
export const TRIAL_DAYS = 7;

function daysBetween(future: string | null): number {
  if (!future) return 0;
  const ms = new Date(future).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export function evaluateAccess(sub: SubscriptionRow | null | undefined): Access {
  if (!sub) return { entitled: false, reason: "none", daysLeft: 0 };

  const now = Date.now();
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end).getTime() : 0;
  const trialEnd = sub.trial_ends_at ? new Date(sub.trial_ends_at).getTime() : 0;

  if (sub.status === "active" && periodEnd > now) {
    return { entitled: true, reason: "active", daysLeft: daysBetween(sub.current_period_end) };
  }
  if (sub.status === "trialing" && trialEnd > now) {
    return { entitled: true, reason: "trialing", daysLeft: daysBetween(sub.trial_ends_at) };
  }
  return { entitled: false, reason: "expired", daysLeft: 0 };
}
