# MEKA CBT — past-question source and commercial-use diligence
**Research date:** 2026-10-31
**Status:** source due diligence; NOT permission to import or sell third-party questions.

## Scope / actual request

Build MEKA School's ₦1,500-per-30-days JAMB/WAEC practice subscription with genuine past questions wherever commercially licensed, and separately labelled original MEKA exam-style questions for gaps. The app has 25 JAMB and 39 WAEC subject selections and a small separately built MEKA question bank. **Do not advertise these selections as completed question banks.**

## Source comparison

| Source | What is useful | Commercial use / constraint | Decision |
| --- | --- | --- | --- |
| JAMB IBASS official syllabus | Exam objectives, detailed topics and 60-question Use of English structure | Syllabus is an authoring reference, **not a dataset licence** | Primary ground truth for format |
| JAMB 2026 UTME officials' manual | 60 English + 40 × 3; 180 questions, 120 minutes | Official exam specification, not permission to copy examination papers | Use for engine specifications |
| WAEC official e-Learning archive | Year-labelled real examination topics/questions, examiner reports, weak areas and assessment expectations | WAEC site explicitly reserves rights; no confirmed blanket commercial republication licence | Use for research and blueprint, link to archive rather than copy |
| Myschool.ng | Year, subject and topic bank; explanations and exam practice | Terms restrict non-approved commercial copying/distribution and derivative use | No scraping/import; request licence from rightsholder if desired |
| ALOC Station | Paid API advertised for external commercial CBT use, by exam, subject and year; developer tier advertised around ₦5,000/month | Up to 48h ephemeral cache, no permanent bank mirroring on normal plans, no client-side secret; underlying historical-paper rights **not independently established**. Public demo payload includes an `isLicensed:false` sample | **Candidate A**, rights proof and trial required |
| SdashAPI | Structured historical question API: exam, subject, year, question id, shared passage, options, answer, explanation, image; paid in-app use advertised | Standard plan permits app display but not database mirroring or raw redistribution; published coverage claims UTME 22 subjects and WASSCE 23 subjects; source-rights chain unverified | **Candidate B**, rights proof and trial required |

### Primary research and terms

- JAMB official IBASS Use of English syllabus: https://ibass.jamb.gov.ng/assets/uploads/Use-of-English.pdf
- JAMB 2026 officials' manual: https://jamb.gov.ng/PDFs/2026/2026%20TRAINING%20MANUAL%20%20final.pdf
- WAEC official subject and examiner archive: https://waeconline.org.ng/e-learning/
- WAEC English exam archive: https://waeconline.org.ng/e-learning/English/Englmain.html
- WAEC Mathematics exam archive: https://waeconline.org.ng/e-learning/Mathematics/mathsmain.html
- Myschool terms: https://myschool.ng/terms-of-use
- ALOC API: https://aloc.com.ng/docs/questions ; terms: https://aloc.com.ng/terms ; pricing: https://aloc.com.ng/
- SdashAPI API: https://sdashapi.com/docs ; terms: https://sdashapi.com/Terms-of-Service ; pricing: https://sdashapi.com/pricing ; coverage: https://sdashapi.com/coverage
- Nigeria Copyright Commission author-rights guidance: https://www.eregistration.copyright.gov.ng/ncc/faq

**Provider pricing and coverage figures are provider claims, not independently audited. Some cached provider pages contradict each other regarding credits, tiers and monthly prices; verify the actual checkout terms before buying.**

## What the current verified pages imply

1. ALOC paid plans explicitly permit commercial incorporation of their API responses into student-facing applications. Its standard plan expressly forbids permanent copying and requires use of backend-only credentials. Its claim of "educational fair-use" for historical questions is **not equivalent to documented original examiner-board redistribution authorisation**.
2. SdashAPI paid plans explicitly permit commercial in-app question display, while its separate dataset licence covers permanent storage only if expressly granted. Its GitHub README acknowledges JAMB/WAEC/NECO retain ownership of underlying exam questions. We must request the actual chain of licensing rights.
3. ALOC's public product screenshot includes `isLicensed:false` on a historical sample. This is not proof that every dataset item lacks permission; it *is* reason to insist on item-level provenance and a written legal response before paid reuse.
4. A subscription to either vendor is **not the same as buying a dataset**; "use the questions" must mean fetching through the agreed authenticated API inside MEKA School, subject to permitted cache periods.
5. SdashAPI reports 22 UTME + 23 WASSCE subjects, below MEKA's 25+39 catalogue. ALOC's legacy site claims 17 subjects and its current landing page does not demonstrate complete syllabus coverage. An authenticated trial must reconcile exact subject/year counts, especially WAEC technical and language subjects.
6. The two providers' examples show `answer` alongside `question`. Sending raw responses to the browser would leak premium answer keys. A backend service must strip answers from delivered practice items and calculate scores server-side.

## Written clearance checklist — required before paid integration

Obtain from the vendor (and check with an IP adviser if necessary):

- Evidence they can authorise **commercial display of historic WAEC/JAMB questions** to paying users, including the underlying board's rights where applicable; identify any items without those rights.
- Exact exam, subject, year, passage, diagram, novel-excerpt and explanation rights granted; geography, term and withdrawal process.
- Whether commercial display inside MEKA is allowed and whether any branding/attribution is required.
- API vs dataset licensing: storage TTL, backup, offline access, passage caching, exam-session continuity and termination requirements.
- Item-level identifiers/source labels and error correction workflow; commitments around incorrect keys.
- Cost per batch, allowed users/concurrency, overage costs, subject coverage and percentage of explanations actually available.
- Rights to show past-question *year* labels and source status faithfully; do not label synthetic questions as historic papers.
- Security/data-protection agreement, failure handling, SLA and privacy controls.

**Do not pay for a commercial plan based only on a marketing claim that it is "licensed."**

## Technical integration blueprint (no provider credentials yet)

New server-only Supabase Edge Function, **not** a browser-side API call:

1. Authenticate Supabase JWT with `auth.getUser()`; check the invoking user has their own `cbt_learners` row and an active, unexpired subscription.
2. Refuse unapproved vendor/source or absent documented licence and secret; **fail closed**.
3. Map MEKA exam `JAMB` -> provider UTME/JAMB, `WAEC` -> WASSCE/WAEC; map subject slugs in a reviewed lookup. Detect unavailable subjects rather than displaying empty "complete" exams.
4. Fetch a limited batch from vendor API on server with a secret stored as a Supabase Edge Function secret. Never expose token or vendor answers in Vite bundle, public GitHub, browser, Supabase `public` tables or logs.
5. Store only permitted non-copyright metadata (provider, external id, exam, year, subject, topic, user attempt, timestamps). If transient text/keys must be cached for scoring, enforce provider cache licence and purge after TTL; do not build an unlicensed permanent database.
6. Return stems, options, media and passage **without keys**; submit an answer to a server endpoint, verify the question belongs to the learner's active session, grade using a protected ephemeral key / authorised provider lookup, then return explanation after submission.
7. Maintain 3-rotation no-repeat by provider ID and learner, using saved attempt metadata and fallback when no more unseen questions exist; never claim 3 complete exams based on provider total-volume marketing.
8. Fetch shared reading passages together with linked questions; protect diagrams and images through same access control. Obtain prescribed reading-text permission separately.
9. Provide safe retries/timeouts on vendor failure, question reporting, audit logs without raw content and no access when subscription/vendor licence expires.
10. Staging tests: free vs activated account, external public learners vs linked school learners, 25/39 catalogue availability matrix, 4-subject 180-question UTME, 3-repeat policy, score correctness, cancellation, provider outage, no answer-key leakage.

## JAMB English format — official IBASS paper blueprint

1 reading passage × 5 questions, 1 cloze passage × 10 questions, 1 approved reading text × 10 questions, sentence interpretation 5, antonyms 5, synonyms 5, sentence completion 10, Oral Forms 10: total 60. The 2026 officials' manual confirms 180 objective questions and 120 minutes for full UTME.

The annual prescribed novel must be rechecked for each session. WAEC must be modelled per subject *and paper* (objective/theory/practical), not universally as 50 objectives.

## Rollout gates

- **Now:** perform legal enquiry and request sample/coverage report from vendor. Continue original MEKA question writing and independent educator review privately.
- **After written rights and trial:** implement a guarded server-side proof-of-concept for ONE subject and year. Do not expose the test API key.
- **After correctness + security checks:** build 4-subject JAMB sessions and paper-aware WAEC mocks with year-labelled historical and clearly tagged MEKA originals.
- **Before ₦1,500 sales:** confirm paid source licence, sufficient bank coverage, complete exam engine, RLS/permissions, no leaked existing answer keys and learner acceptance tests. Keep `cbt_subscription_plans.sales_enabled=false` until explicitly approved.

**Research only — no third-party past questions copied, imported, published or sold during this stage.**
