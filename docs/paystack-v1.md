# MEKA School — Paystack V1

## Flow

1. Admin/Secretary creates a secure parent payment link through `paystack-links`.
2. Parent opens `/pay?token=...`.
3. `paystack-payment-link` returns only the linked school's payment details.
4. Parent enters email and amount.
5. `paystack-initialize` creates a `payment_intents` row and initializes Paystack server-side.
6. Parent completes Paystack Checkout.
7. Paystack sends `charge.success` to `paystack-webhook`.
8. The webhook verifies the signature, verifies the transaction with Paystack, then calls the database finalizer.
9. The finalizer validates school/student/fee-account ownership and exact NGN amount, writes the existing `payments` ledger row, creates the receipt, and updates the fee-account balance.

Paystack amounts are sent in the currency subunit, so NGN amounts are multiplied by 100 during initialization and compared against the verified transaction amount before value is delivered.

## Required Supabase secrets

Set these as Edge Function secrets:

- `PAYSTACK_SECRET_KEY` — use a test secret while developing.
- `PUBLIC_APP_URL` — the deployed MEKA School frontend URL.

Do not put `PAYSTACK_SECRET_KEY` in Vite/client environment variables or commit it to Git. Paystack's secret keys are backend-only credentials.

## Paystack dashboard

Set the webhook URL to:

`https://<project-ref>.supabase.co/functions/v1/paystack-webhook`

The webhook function has JWT verification disabled because Paystack does not send a Supabase user JWT. It verifies Paystack's `x-paystack-signature` using HMAC SHA-512 before processing the payload.

## Important production rule

Do not treat a successful browser redirect as proof of payment. The webhook/verification path is the source used to update the MEKA ledger. Paystack recommends webhooks for confirming successful payments before delivering value.

## Current test target

- Abiona Desmond
- Admission No: `PRE2026256`
- Fee account: `c979ec97-79ce-4e72-885f-946da1acdb9f`
- Starting balance: ₦122,300

The intended first test is ₦1,000 in Paystack Test Mode. Expected balance after successful webhook finalization: ₦121,300.

No live transaction is required for this test.
