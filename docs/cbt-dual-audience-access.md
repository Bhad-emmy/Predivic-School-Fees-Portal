# Public MEKA CBT: open access + optional school affiliation

This foundation is public-first: **any learner can sign up for MEKA CBT**, whether or not their school uses MEKA School. School affiliation is optional and verified through a one-time invitation. The initial purpose is WAEC/JAMB mock preparation only.

## Entry point
- Public `/learn` supports email/password signup and login. Learners do not need a school admission number, a school subscription or an invitation.
- Every new learner initially creates an independent CBT profile after authentication.
- Learners enrolled in a MEKA School can **optionally link the same existing account** to their registered school using a single-use 48-hour invitation from that school admin. They do not need to register twice, and their mock attempt history remains associated with the same auth_user_id.
- A school student account is linked server-side to an existing `students.id` and `schools.id` record; never trust a submitted admission number as authorization.
- No registration or conversion route attaches a learner to a school without a code. CBT public registration does not create any school student record.

## Access boundaries
- `cbt_learners` distinguishes `external` from `school` affiliations; public profiles start with no school or student ID. The protected redemption function upgrades an existing public profile rather than creating a second identity.
- Self-service RLS inserts only allow external profiles belonging to the authenticated user.
- Admin invitation issuance verifies the current authenticated account is an **active admin of the student's active school**.
- Invitation tokens are random, hashed in Postgres, single-use, and expire after 48 hours; issuing another revokes prior unused codes.
- Redeeming checks the invited student and school are still active. The transaction locks the invite to prevent double use and upgrades the profile through a security-definer function. There is no direct client-side UPDATE permission.
- Only the current learner and the relevant school's active admin can select a learner profile; all other data must have its own RLS policies.
- No question, mark, or academic report data is exposed by this migration.

## Product scope: WAEC and JAMB mocks only
- The initial CBT launch is for **WAEC and JAMB exam preparation**, not actual school term examinations or quizzes.
- Both independently registered learners and verified school-linked students can access the same rights-cleared WAEC/JAMB question bank, mock exams, corrections and study materials.
- Study materials may be shared globally when licensed, or restricted to a particular school. Private student/school information remains isolated.
- Start with objective questions, timed practice, topic practice, explanations, scoring and weak-topic reports.
- Store exam type (WAEC/JAMB), subject, syllabus topic, year (if authentic and known), original/licensed source classification, permissions and review status.
- Legitimate past questions may be distributed only with sufficient rights; never imply access to unreleased upcoming papers. Original exam-style practice questions are permitted.
- Correct answers must never be sent with the pre-submission question payload. Calculate marks server-side after submission.
- **All CBT attempts and scores are practice-only**. There is no integration with school term results; the separate Result Checker manages official school results independently.
- School staff may eventually review their own linked learners' aggregate/mock progress, subject to appropriate authorization; they cannot see outside learners' records.

## Suggested implementation sequence
1. Verify existing migration and registration flow for both audience types in staging, including RLS and school invitation redemption.
2. Create rights-aware subject, topic, question, choice, answer and revision-material schemas with safe access policies.
3. Add an admin-reviewed question import/content authoring flow; do not scrape or import copyrighted question banks without rights.
4. Implement server-controlled timed WAEC/JAMB practice, answer saving, submission, grading and explanations.
5. Expose learner history, correction review and optional authorized school-cohort progress reporting.
6. Keep the separate Result Management & Checker workflow independent.

## Deployment prerequisites
1. Review and apply `supabase/migrations/20261029180000_cbt_dual_audience_identity.sql` in a safe test environment and verify all policies and functions.
2. Only after the schema has been applied should the `/learn` UI and school invitation UI be deployed.
3. Verify Supabase Auth email/password signup is permitted, email confirmations and redirects point users back to the app, and password reset works.
4. Validate each role path (school admin, teacher, school-linked student, independent learner, parent, stranger) against other schools' data.
5. Provide safeguarding and privacy handling for underage learners; ensure student invitations are delivered privately.

## Required verification checks
- Independent learner can sign up, verify email, login, create a profile, sign out and sign back in.
- Independent learner cannot insert `learner_type = 'school'`, set `school_id`, or set `student_id` directly; cannot view others' profiles.
- Student cannot create a school login from an admission number alone.
- Active school admin can issue a code for their own active student only; teachers and outside learners cannot issue codes.
- A code can be redeemed only once, only before expiration, and only for an active school/student.
- Previously issued unused code is revoked by issuing a new code.
- A learner can remain independent or link once to their verified school; they cannot claim a second school student identity, and a student cannot be linked to multiple auth accounts.
- Public-first identity must keep mock attempt history under auth_user_id so future school linking does not reset performance.
- Student login and independent login do not grant teacher, fee, attendance, or parent portal permissions.
- Existing school student, teacher, fee and attendance workflows stay unchanged.

## Not implemented yet
Question bank, study materials, WAEC/JAMB question content, mock attempt submission, grading, performance analytics, payments, and the separate school result checker. The learner dashboard labels mock features clearly as coming soon.

## Public launch and scale requirements
- This foundation is **not a production-ready, nationally scaled CBT**. It only introduces the learner sign-up and optional school-link flows, not the question engine or content licensing.
- Before broad registration, check the blast radius of using the existing school-finance Supabase project for public sign-ups. A dedicated CBT backend/auth project and secure school-account linking is recommended for high-scale public traffic, isolation and independent rate limits.
- Add verified contact details, account recovery, abuse prevention, bot protection, request throttling and an age-appropriate privacy/parental consent design before mass public access.
- Define operating costs, question-library rights, storage/bandwidth, database indexing, CDN caching, load testing and disaster recovery before opening to large traffic.
- The public landing can use `/learn` during the pilot; a standalone public CBT domain can be added later without requiring a school subscription.

## Additional public-first verification
- Any person can create an independent learner profile without a code, and that registration does not create a student, staff, fee, parent or result record.
- An independent learner can redeem a valid same-school invitation later and retain the same auth_user_id; verify prior mock attempt records stay intact once mock attempts exist.
- Replay of a used invitation, forging school_id, claiming someone else's student_id and linking to a second school all fail.
- Public learner sessions cannot read school finance, attendance, private exam notes, another learner's practice activity, private school materials, or staff-only data.
