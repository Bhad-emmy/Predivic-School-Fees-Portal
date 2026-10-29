# MEKA CBT staging validation checklist

**Status:** pending staging execution. Never run test writes against the production school database or assume passing frontend checks prove RLS works.

## Prerequisites
1. Get approval for the optional Supabase test-branch compute cost. The live project currently has **no** development branch.
2. Apply the still-unmerged additive CBT identity/payment/question-bank migration to the **test branch only**.
3. Create separate test Auth accounts for: MEKA operator (allowlisted), school admin (not allowlisted), ordinary staff, free independent learner, activated independent learner, school-linked learner and unrelated school-linked learner.
4. Add only original or explicitly rights-cleared practice questions as test fixtures. Keep bank transfers, parent accounts and finance information out of the test dataset.
5. Provision the CBT operator in `private.cbt_platform_operators` only after independently checking its Auth UID and admin role; never hardcode names or user identifiers into migrations.

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

## Existing project security notes (baseline, before CBT migration)
Supabase's current security advisor reported:
- `override_student_attendance` is a callable security-definer RPC. Assess its internal authorization separately before changing school attendance functionality.
- Leaked-password protection is disabled. Enable it when configuring broad public CBT signup, subject to Supabase plan availability.

Reference: https://supabase.com/docs/guides/database/database-linter and https://supabase.com/docs/guides/auth/password-security
