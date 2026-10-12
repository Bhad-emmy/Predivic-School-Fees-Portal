# MEKA School Cashless — Predivic MVP

## Status
Design and implementation specification. This document does not activate the module in production and does not change database data.

## Product scope
MEKA School Cashless is an optional module inside the existing MEKA School application. The first pilot customer is Predivic School. The store and canteen are owned by Predivic.

## Pilot workflow
1. Reuse the existing school, student, staff and class records; do not duplicate student master data.
2. Issue each participating student a unique, revocable QR identifier printed on a silicone wristband. The QR must not embed balance, parent contact details, sequential IDs, or payment credentials.
3. Parent transfers money to a school-designated account. An authorised staff member verifies the bank transaction against the actual account transaction before posting a wallet credit.
4. An authorised school cashier can record cash received at school and issue a receipt. Cash collection must be reconciled to the physical till and subsequent bank deposit.
5. At the physical store, the cashier scans a wristband, selects product(s) and quantities, confirms the total, and submits the sale.
6. The backend atomically validates staff permissions, active school and student, active wristband, product availability, and sufficient wallet funds. It then records the sale, sale lines, ledger debit and stock movement as one transaction.
7. A student can never spend more than the available balance. Purchases on credit are not supported.
8. Refunds and corrections are explicit, authorised, reason-coded reversal transactions. Never edit or delete posted ledger entries or silently overwrite a balance.
9. School reports reconcile bank transfer credits, cash credits, wallet balances, sales, refunds and inventory.

## Initial release boundaries
- No Paystack integration for Cashless.
- No automatic bank transfer detection in the first release.
- No wallet withdrawals, peer-to-peer transfers, or use outside the school.
- No online store; this module serves the school's physical canteen/store.
- No direct browser writes that can change balances.
- No production migration until the schema, RLS policies and transaction functions have been reviewed and tested in an isolated development environment.

## Data model draft
- `school_modules`: school-scoped module enablement; Cashless is disabled by default and enabled only for the Predivic pilot.
- `student_wallets`: one wallet per school/student, balance derived from or maintained transactionally with the immutable ledger.
- `wallet_transactions`: append-only credits/debits/reversals with unique idempotency/reference keys, actor, source, amount and timestamp.
- `student_wristbands`: hashed random token, school/student IDs, issue/activation/deactivation metadata.
- `store_products`: school-scoped SKU/name/price/availability/inventory.
- `store_sales` and `store_sale_items`: cashier, student, totals, item snapshots, timestamps and status.
- `cashless_audit_events`: privileged actions, overrides, wristband changes and funding verification.

All amount columns should be integer minor units (kobo) or another explicitly documented currency-safe representation, not floating-point values.

## Security and integrity requirements
- Enforce tenant isolation using the existing school-scoping helpers and Supabase Row Level Security.
- Derive staff identity and role from the authenticated session, never from browser-supplied fields.
- Cashier can scan students and submit sales but cannot issue wallet credits or modify products unless explicitly permitted.
- Funding staff can create verified credits; credit must record payment channel and verified bank reference or cash receipt reference.
- Use a protected database function for sale posting so balance check, debit, sale lines and inventory decrement are atomic under concurrency.
- Add unique constraints/idempotency controls so duplicate requests cannot post twice.
- QR token must be random, unguessable and revocable; do not store the raw token if a secure hash lookup can be used.
- Keep all actions school-scoped and auditable.
- Use non-production test data for development.
- Do not place service-role credentials in frontend code.

## Migration and rollout
1. Inspect existing production schema and school scoping policies in full.
2. Create and test migrations in a separate development Supabase project.
3. Build the Cashless navigation and screens behind a module flag disabled by default.
4. Test role boundaries, cross-school isolation, duplicate submissions, simultaneous purchases, insufficient balance, revocation, refund and reconciliation.
5. Obtain school confirmation of the funding/holding arrangement before taking live prepaid funds.
6. Enable the feature for Predivic only after sign-off.
7. Add automatic bank-transfer detection only after a supported bank integration is approved and verified.

## Acceptance criteria
- Wallet starts at zero until an authorised, verified credit is posted.
- A sale is declined for insufficient funds, inactive wallet/card/student, unavailable products or unauthorised cashier.
- Concurrent sales cannot overspend a wallet.
- A duplicate request cannot create a second debit or sale.
- Deactivated wristbands cannot be used.
- Refunds post compensating transactions and preserve the original sale.
- Staff permissions prevent a cashier from crediting their own or another wallet.
- Reports reconcile ledger totals to posted sales, funding credits and refunds.
- Other schools cannot read or mutate Predivic cashless records.
