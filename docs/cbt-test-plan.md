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

## Starter premium bank and timed mini-mock checks — 2026-10-30
- **Content:** 39 original premium questions were added to the CBT database (WAEC 18, JAMB 21), plus the existing 10 original free-preview questions (WAEC 5, JAMB 5). These are original practice items, **not officially sourced or licensed past papers**, and they remain subject to editorial review.
- **Paid visibility:** A simulated unactivated CBT learner cannot SELECT premium questions; a rollback-only redeemed test PIN allows the same learner to see all 39.
- **PIN lifetime:** Two synthetic PINs used in a single rolled-back transaction proved initial 30-day activation, early renewal extension by another 30 days, and rejection of a reused PIN.
- **Timed practice backend:** Applied additive migration version `20261030201634_cbt_paid_timed_mini_mocks`, now stored at `supabase/migrations/20261030201634_cbt_paid_timed_mini_mocks.sql`. Paid sessions randomly select 10 premium questions and enforce a 10-minute deadline **on the server**.
- **Timed practice tests:** A simulated unactivated learner was denied session creation. A synthetic activated learner started a mock, received 10 question stems without answer keys, could save an answer, was denied corrections before submission, could submit for server-calculated score and obtain corrections only afterward. Repeated submission returned the same score.
- **Deadline/ownership tests:** A rollback-only expired session refused new answers; finalization scored it as zero. Another account was denied access to its corrections.
- **No test data persisted:** Mock learner accounts, activation grants and sessions created for transactional tests were all rolled back. Final verification: 10 free questions, 39 premium questions, 0 genuine learners, 0 issued PINs, 0 mini-mock sessions, and `sales_enabled = false`.
- **Frontend:** `src/components/CBTTimedMiniMock.jsx` is wired to the public learner portal on the **draft** feature branch, not yet merged to the production frontend. This is a timed **mini mock**, not a full WAEC paper or a faithful JAMB subject-combination simulation.
- **Before commercial release:** editorial question audit, much larger subject-specific/licensed-or-original question bank, optional full test formats, user-supplied study notes, real browser/login/redirect E2E testing, OPay receipt verification, rate limiting, and comprehensive RLS/tenant tests. Keep PIN sales disabled.

## Per-learner rotation and large question bank pipeline — 2026-10-30
- **Rotation is installed in the existing Supabase project**, migration history version `20261030203302_cbt_mini_mock_least_seen_rotation`. The `start_cbt_mini_mock` function counts per-learner appearances of each premium question in earlier mocks, selects **unseen questions before previously displayed questions**, otherwise prefers **least seen and least recently presented**, and uses fresh randomness for tie-breaks and display order. A question is considered *seen* once assigned to a mock, even if skipped by the student.
- **Transactional tests passed and rolled back:** WAEC currently has only 18 premium questions; a second 10-question WAEC mock repeats exactly 2, the minimum mathematically possible. JAMB currently has 21 premium questions; the first two 10-question JAMB mocks have no repeats, and a third session ensures all 21 have been used. No simulated learner, session or PIN persists.
- **Important limitation:** A finite bank cannot provide an infinite number of entirely new exams. Rotation minimizes repeats *per learner* and only reintroduces previously seen questions once the current approved pool is exhausted.
- **Bulk import installed** as `20261030203502_cbt_bulk_question_import`: protected JSON import of up to 50 questions per call; validates schema/content-source evidence, rejects duplicate stems per exam and subject, and **always stores drafts**. Publishing is a separate editorial step. A single invalid item aborts the entire batch.
- **Protected editor review installed** as `20261030203658_cbt_operator_question_review`: only allowlisted content operators may review answer keys and explanations through the dedicated RPC; unauthorized user rejected. The editor's direct publish control was removed in favour of the gated editorial review queue.
- **Transactional tests passed and rolled back:** one 2-question JSON batch created two unpublished questions; a repeat import was rejected by unique constraint, and an unauthorized account could neither import nor read aggregated bank coverage. Authorized answer review returned the private key, while unauthorized review was denied. Production question count remains **10 free + 39 premium**, with zero imported drafts.
- **Admin UI (draft PR only):** `CBTBatchImport.jsx` shows syllabus-bank readiness targets and accepts 1–50 JSON questions per batch; `CBTReviewQueue.jsx` provides paginated review, correct-answer and rights inspection, and an explicit editorial confirmation before publication.
- **Content target, not current availability:** for five non-repeating full JAMB-style exams per learner, plan at least 300 reviewed Use of English questions (5×60) and 200 reviewed per other subject (5×40). WAEC planning starts at 250 questions per subject, to be adjusted to each paper's format. These are **MEKA's quality targets**, not official question quotas; many subjects remain far below them or empty.
- Full 180-question four-subject UTME-style simulation, per-topic distribution, WAEC subject-specific test formats and editorial syllabus audits remain under development. The current mini-mock mixes subjects within an exam category and is **not** a faithful full JAMB/WAEC paper. Never market it as one.
- Manual OPay PIN sales remain disabled. Keep public promotion and payment requests off until original/licensed question inventory, browser E2E and operator/security checks meet the approved release gate.
