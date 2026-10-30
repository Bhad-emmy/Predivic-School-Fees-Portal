# MEKA CBT staging validation checklist

**Status:** pending staging execution. Never run test writes against the production school database or assume passing frontend checks prove RLS works.

## Prerequisites
1. Get approval for the optional Supabase test-branch compute cost. The live project currently has **no** development branch.
2. **Current status (2026-10-30):** The additive CBT migration was already applied to the existing production Supabase project at version `20261030200456`; this file is now a read-only verification matrix, not permission to reapply a second copy. The user declined a separate paid branch. Do not rerun the migration in production.
3. Create separate test Auth accounts for: MEKA operator (allowlisted), school admin (not allowlisted), ordinary staff, free independent learner, activated independent learner, school-linked learner and unrelated school-linked learner.
4. Add only original or explicitly rights-cleared practice questions as test fixtures. Keep bank transfers, parent accounts and finance information out of the test dataset.
5. One verified active school-admin account was provisioned in `private.cbt_platform_operators` after an exact unique Auth/email and active-role match. Never hardcode names or user identifiers in migrations. Do not activate sales until role tests complete.

## Authorization tests
| Action | Anonymous | Free learner | Activated learner | School admin (unlisted) | Allowlisted platform operator |
|---|---:|---:|---:|---:|---:|
| Read published free practice | Deny | Allow | Allow | Deny, unless own learner account | Allow |
| Read published premium practice | Deny | Deny | Allow until expiry | Deny, unless independently activated | Allow |
| Read question answers before submitting | Deny | Deny | Deny | Deny | Deny direct API access |
| Submit entitled question answer | Deny | Free only | Free + premium | Deny without learner profile | Can test using learner profile |
| Insert question or change answer directly | Deny | Deny | Deny | Deny | Deny; use protected create RPC |
| Create question via RPC | Deny | Deny | Deny | Deny | Allow, as draft |
| Publish reviewed question via RPC | Deny | Deny | Deny | Deny | Allow |
| Generate payment PIN without verified OPay reference | Deny | Deny | Deny | Deny | Deny by process |
| Generate PIN after verified payment when sales disabled | Deny | Deny | Deny | Deny | Deny |
| Generate PIN after verified payment when sales enabled | Deny | Deny | Deny | Deny | Allow, unique reference only |

## Manual OPay workflow
- Confirm correct receiving OPay account name and account number privately with owner; do not commit details to git.
- Verify the actual inbound ₦1,500 credit and OPay transaction reference inside OPay itself; a screenshot alone is never sufficient.
- Before sales are enabled, the operator screen shows that issuance is disabled; public WhatsApp CTA is hidden.
- After operator provisioning and test approval, enable sales by a trusted migration or privileged database operation, and ensure unauthorized roles still cannot issue.
- One verified OPay reference produces only one PIN, even if repeated with different capitalization or whitespace.
- Redeeming a PIN is atomic: two users cannot simultaneously redeem it.
- Early renewal preserves remaining days; late renewal starts a new 30-day period.
- The PIN is not stored in plaintext, and no ordinary user can query code hashes.
- No fee payment, receipt, attendance or school-report table is modified by CBT activation.

## Question-bank and practice tests
- New question always starts as unpublished; ordinary learners cannot read drafts.
- An original question can be published after content review; a licensed question needs documented redistribution permission and manual verification.
- Free signed-in learner can read only approved free-preview questions, never premium.
- Active paid learner can access approved premium content; after expiry, server denies access even if the browser shows an old status.
- Correct option and explanation are never included in pre-submission question SELECT results.
- `submit_cbt_practice_answer` scores on the server, records an attempt linked to the current Auth UID and returns the correction only after submission.
- Learner A cannot see Learner B's attempts; school A cannot read school B's learner records.
- Linking a public account to a school does not change the Auth UID or erase prior practice attempts.
- Input validation rejects missing options, invalid answer letters, insufficient question text and invalid subject/topic.
- Load test with the target number of concurrent learners before broad public release.

## Known incomplete functionality
- Timed full WAEC/JAMB mock sessions, autosave, timer expiry, assignment limits and final score reports are **not yet implemented**.
- Bulk import and copyright/legal clearance workflows are **not yet implemented**.
- Free demo requires an approved published sample question; this repository intentionally seeds **no** real past examination papers.
- Public support/WhatsApp routing, payment reconciliation/refunds and minor-specific privacy handling require launch review.
- Do not assume a frontend lint/build pass verifies the database migration or security-definer RPCs.

## Existing project security notes and post-migration advisors
Supabase's current security advisor reported:
- `override_student_attendance` is a callable security-definer RPC. Assess its internal authorization separately before changing school attendance functionality.
- Leaked-password protection is disabled. Enable it when configuring broad public CBT signup, subject to Supabase plan availability.

Reference: https://supabase.com/docs/guides/database/database-linter and https://supabase.com/docs/guides/auth/password-security

## Verification already completed (2026-10-30)
- Applied one additive CBT migration to current project. Migration history version is `20261030200456`; source file was renamed to match it to avoid later duplicate migration execution.
- Nine CBT tables present, RLS enabled throughout; no direct access to private answer keys or activation-PIN hashes for authenticated role; private PIN issuer not executable by authenticated role.
- Proposed retail plan `monthly_30` = ₦1,500 / 30 days with `sales_enabled = false`.
- One operator account allowlisted; confirmed database still has the previously recorded 429 students, 5 teachers and one school.
- New privileged RPC warnings observed from the Supabase security advisor. Before enabling sales, validate all exposed RPC authorization paths with independent signed-in user sessions and test that unauthorized users cannot issue PINs or get unpublished/private answers.
- **Not complete:** browser authentication tests, direct PostgREST role e2e tests, verified OPay transfer, manual PIN issuance/redemption, attempt scoring tests, full timed mock engine, production frontend deployment.

## Verified demo content and transactional access tests — 2026-10-30
- Ten **original, MEKA-authored** (not genuine historical WAEC/JAMB) multiple-choice practice samples were inserted and published through the CBT operator's question creation/publishing SQL functions, covering five WAEC and five JAMB subjects.
- All ten are approved **free-preview** items; each has a private server-side answer key and an explanation. No licensed past examination questions have been imported.
- Transactional SQL smoke test (rolled back) simulated an approved operator: question drafting then publication succeeded; a manual OPay PIN issuance attempt was rejected while `sales_enabled = false`. The rollback left no test question or PIN.
- Separate transactional SQL smoke test (rolled back) simulated an ordinary signed-in school staff account acting as an independent CBT learner: it was denied CBT operator status, saw zero questions before learner registration, could create an external learner profile and view ten public previews, and could submit the correct answer to an original sample question for server-calculated scoring with a private answer key. The rollback left no CBT learner or attempt records.
- Confirmed current persistent counts after tests: 10 approved free sample questions, 0 CBT learner registrations, 0 CBT attempts, 0 issued PINs, `sales_enabled = false`.
- **Testing limitations:** SQL role/JWT claim simulation is not a real browser sign-in, and the tests are not comprehensive security certification. Browser-based signup/email verification, RLS with multiple tenant identities, free-vs-paid restrictions, PIN redemption/renewal and edge-case/concurrent access still require end-to-end testing.

## Premium access isolation test — 2026-10-30
- Created and published a **temporary premium-only original question** using the authorized operator account within a single SQL transaction.
- Simulated a signed-in learner without a PIN and verified the premium question remained hidden by RLS.
- Confirmed that server-side answer submission for the premium question failed with an access error; an unprivileged user also could not issue an OPay activation PIN.
- Rolled back the test transaction. Post-test persisted counts: 10 approved free demos, no premium test question, zero learner profiles, zero attempts, zero PINs; monthly OPay sales remain disabled.
- These are transactional SQL role simulations, **not** real browser/JWT/PostgREST end-to-end tests.
