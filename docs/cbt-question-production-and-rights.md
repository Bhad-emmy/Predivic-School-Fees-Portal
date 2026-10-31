# MEKA CBT — question sourcing, editorial review and staged development

**Prepared:** 2026-10-31. **Status:** content-development plan; NOT a paid-launch approval.

## 1. Research findings and rights

- Myschool's exam practice offers large subject/year/topic collections, answers, explanations, timed CBT, bookmarking, search, performance history and offline practice: https://myschool.ng/download-the-myschool-app
- TestDriller supports timed UTME combinations, topic practice, four-subject selection and result analysis: https://www.testdriller.com/utme
- WAEC's own educational website is a valuable source for examination requirements and examiner observations: https://www.waeconline.org.ng/e-learning/
- JAMB official Use of English syllabus: https://ibass.jamb.gov.ng/assets/uploads/Use-of-English.pdf
- JAMB official 2026 examination structure (180 questions; 60 Use of English and 40 for each of three other subjects; two hours): https://jamb.gov.ng/PDFs/2026/2026%20TRAINING%20MANUAL%20%20final.pdf
- Myschool's content copyright and commercial-use restrictions: https://myschool.ng/terms-of-use

**Copyright rule:** Do NOT scrape or bulk-copy questions, explanations, passages, graphics, solutions, answer keys or book excerpts from Myschool, TestDriller, other online question archives or WAEC. An app activation or reseller licence is not a licence to reproduce its question bank. Real past-paper material needs written redistribution permission and a source/permission audit record. All unlicensed MEKA practice items must be independently written and labelled **original exam-style**, never `official past question`. Questions about a prescribed novel must not reproduce copyright-protected passages without permission.

## 2. First private batch — JAMB Use of English

- Private Supabase backend: `uojxficqrfuzmknetlmb`.
- As at 2026-10-31: 14 newly authored *original* JAMB Use of English items imported through the operator-only batch RPC and **kept unpublished**. Their answer keys are in `private.cbt_question_keys`. The app does not expose these drafts to ordinary learners.
- These are provisional editorial drafts, not independently educator-verified items.
- **2026-10-31 first-pass editorial check:** inspected each of the 14 private stems, answer options and explanations. Three items lacked explicit synonym/antonym directions; corrected those three question stems directly in unpublished Supabase drafts. Verified 14 unpublished drafts, all 14 protected keys present, and no changes to seven existing published English questions. This is **not** an independent teacher approval.
- **Remaining editorial gate:** second reviewer must independently confirm phonetic distinctions, word stress, context and distractor ambiguity, and sign off the full batch before any item is published.
- Syllabus section B: synonyms (2), antonyms (2), sentence interpretation (1), idioms (1), concord (1), conditional sentences (1), sequence of tenses (1), prepositions (1), question tags (1).
- Syllabus section C: consonant distinction (1), word stress (1), homophones (1).
- This batch deliberately omits passage and cloze questions until grouped-passage storage, linked items and answer review are implemented.
- Existing JAMB Use of English published count remains 7; these 14 drafts do **not** increase paid available inventory.

### Full JAMB Use of English blueprint

Per 60-question mock, using the currently referenced official Use of English syllabus as the provisional format:

| Section | Questions per mock | Three fresh mocks |
| --- | ---: | ---: |
| Comprehension passage | 5 | 15 |
| Cloze passage | 10 | 30 |
| Approved reading text | 10 | 30 |
| Sentence interpretation | 5 | 15 |
| Antonyms | 5 | 15 |
| Synonyms | 5 | 15 |
| Sentence completion / grammar | 10 | 30 |
| Oral English | 10 | 30 |
| **Total** | **60** | **180** |

The annual prescribed text must be confirmed against JAMB's current syllabus before authoring that year's reading-text questions. Do not fill this allocation with generic vocabulary items.

For other UTME subjects, the initial target is 120 *distinct, editorially approved* questions (3 × 40) **per subject**. Full UTME simulation additionally requires a subject-combination selector, four-subject session structure, 120-minute timer and per-subject performance feedback. Existing 10-question mini-mocks are not full-UTME simulations.

For WAEC, **do not assume 50 objective questions in every subject**. Verify the actual objective, theory, practical and paper structures from current official subject specifications before defining three complete rotations. A blanket 150-question planning target is not proof of full WAEC coverage.

## 3. Editorial and publishing gate

Each content batch is deliberately small (10–20 items initially), with:

1. **Syllabus mapping:** exam, subject, topic, subskill and the exact board syllabus edition / assessment year.
2. **Originality and legal basis:** authoring provenance, `original` or `licensed`, proof of written permission for each licensed collection.
3. **Difficulty and quality:** exam-appropriate wording, unambiguous stem, one defensible correct option, plausible wrong options, balanced coverage of easy/medium/difficult items.
4. **Answer checking:** independent check of correct choice, technical calculations/pronunciation/grammar and full reasoning; no reliance only on the authoring model's own key.
5. **App behaviour:** answer hidden until submission, explanation displayed after scoring; free samples work without PIN; premium answer access requires active PIN.
6. **Duplicate detection:** check exact and close paraphrase duplicates across exam, subject, historical rotations and existing content.
7. **Review status:** import in **draft**, review by an editor with subject knowledge, publish only after independent sign-off. Do not use the publication checkbox as evidence of a real external review.
8. **Post-publication audit:** verify published count, free/premium visibility, scoring, subscription expiry, topic distribution, rotation and no cross-school data exposure.

## 4. Security: public repository is not a content vault

The MEKA School app GitHub repository is currently **public**. Public Git commits can reveal any answer key placed in JSON or SQL, even if the file is later deleted. The earlier `content/cbt/three_rotation_mini_mock_starter_originals.json` on `main` contains answer keys for 21 original practice items, including premium items; those keys should be treated as **exposed**. Other historical seed questions/migrations should be audited too. During this research, 18 experimental JAMB-English prototypes were briefly committed to a public development branch before the mistake was detected; the file was subsequently removed from the branch tip, but Git history still retains the commit. **Do not publish these 18 prototypes as paid content.** The separate 14-question batch imported privately into Supabase is the pending editorial batch.

**Rules:**
- Keep paid answer keys and unpublished drafts in the protected Supabase database or a genuinely **private** content repository with tightly controlled access.
- Do not commit `correct_option` or protected explanations for premium questions to public Git, GitHub Actions logs, frontend bundles or publicly served assets.
- Simply deleting a Git-tracked answer file does NOT remove it from Git history.
- Before paid launch: either retire/replace compromised premium questions and separately protect all future content, or fully review another defensible restricted-source strategy. Confirm rights and security in addition to editorial content readiness.

## 5. Next content-development steps

1. Have a qualified English teacher review the 14 unpublished items, correcting any ambiguity, pronunciation or grammar issues.
2. Add private, reviewable passage / cloze group structure before creating comprehension and cloze sets. No copying external passages.
3. Write an original short comprehension passage and 5 attached questions as a first end-to-end engine test, held as drafts.
4. Implement balanced JAMB English section allocation and per-learner three-rotation tracking *within this subject*.
5. Repeat small reviewed batches until the 180-English-question target is reached, then other high-demand subjects, followed by WAEC objective/theory formats.
6. Keep OPay subscription sales disabled pending complete content, multi-user security verification and real-browser acceptance testing.
