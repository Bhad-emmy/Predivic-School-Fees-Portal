// Proposed plan only: this is not a checkout or proof of payment.
// The authoritative server-side offer is in cbt_subscription_plans.
export const CBT_MONTHLY_PLAN = Object.freeze({
  code: "monthly_30",
  durationDays: 30,
  priceKobo: 150000,
  currency: "NGN",
  salesEnabled: false,
});

export const formatCbtPrice = (plan = CBT_MONTHLY_PLAN) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: plan.currency,
    maximumFractionDigits: 0,
  }).format(plan.priceKobo / 100);
