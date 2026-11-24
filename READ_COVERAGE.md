# READ_COVERAGE — SERS (`anas8273/sers-preview`) Authoritative Source & Evidence Coverage

**As of:** 2026-11-24T03:06:00Z  
**Prepared by:** Role 2 (Requirements & Business Logic Analyst) & Role 8 (Security, Privacy & Ops Reviewer) — cross-verified against Role 1, Role 3, Role 4, and Role 5 surveys  
**Authoritative Repository:** `https://github.com/anas8273/sers-preview`  
**Execution Worktree Target:** `C:\Users\ANAS\Desktop\مشروع التخرج\sers-preview-reconcile` (`reconcile/pr41-pr40-2026-11-24`, base `70ee7d6`)  
**Read-Only Reference Root:** `C:\Users\ANAS\Desktop\مشروع التخرج\sers-preview`

---

## 1. Executive Summary & Git Reference Inventory

1. **Local vs Remote `main` Discrepancy (Verified):**
   - `C:\Users\ANAS\Desktop\مشروع التخرج\sers-preview` local `refs/heads/main` is at `1777f28240d83c7cacf0f98138f3fffa70f9cb31` (`2026-06-01`, pre-PR #39). **Do NOT use `1777f28` as a baseline.**
   - `origin/main` is at `e666157a988f10efd6dcae5e808526ae32985945` (`Merge pull request #39`, `2026-11-06`, tree `68fb895c3ba8e89cf2beeff33a6835d89c6504c8`).
2. **Pull Requests #40, #41, and #42 (`SERS_Handoff_2026-11-23/REPOSITORY_STATE.json` & `sers-preview` git objects):**

| Ref | Branch / Head | Commit SHA | Original Tree SHA | Delivered Tree SHA (excl. 89 `.manus/db` logs) | State (2026-11-23) | Changed Files vs `e666157` | CI Checks (6 Required) | Disposition |
|---|---|---|---|---|---|---|---|---|
| `origin/main` | `main` | `e666157a988f10efd6dcae5e808526ae32985945` | `68fb895c3ba8e89cf2beeff33a6835d89c6504c8` | `b2f13d472446feefba7124380bf3973be9cf8fc2` | Protected (`main`) | Baseline (PR #39 merged) | 6/6 required on `main` | Merged baseline |
| **PR #40** | `fix/staging-release-recovery` | `1e8a4e468a8f569573b154fe5d2639ff4560a62b` | `1aa81c87aab349c59088527788b62dc84a19a081` | `a02afcdbcae063fb8c0fc0a066b8ef97e6e24faf` | Open, Draft (`merged: false`) | **55** (24 overlap PR #41, 31 unique) | **4/6** (`compose-backup-restore` & `candidate-portability` failed on `image-inspect-command`) | Semantic port of Arabic identity/fonts/numerals/a11y/tests onto PR #41 |
| **PR #41** | `fix/foundation-gate-20261118-code-review` | `70ee7d6393e5c621b9e3b4df2980a1e6b97176c4` | `9c020b49bed371ab1270e1fa1597a3a76ef514e1` | `4ae5053a57151d7db77b67549608598e726860d5` | Open, Draft (`merged: false`) | **179** | **6/6 passed** (`2026-11-22T00:41Z`; `quality`: 979 passed, 157 skipped, 4 excluded legacy) | **Base of `reconcile/pr41-pr40-2026-11-24`** |
| **PR #42** | `anas8273-patch-1` | `3204819cc1380ae6cda4a68713d82981f55b6306` | `9a8017803d7cfdddcb603f6e0f65f9ec03ab8087` | `06c2dcc46828575ba1748b1d000313b7fc21e143` | Open, Non-draft (`merged: false`) | **3** (`.github/workflows/{ci,mysql-legacy,operations}.yml`) | **2/6** (4 failed) | **Superseded / Reject merge** (reverts `pnpm` to `10.18.1`) |
| Historical `SERS` | `anas8273/SERS` | Historical archive (Laravel 12 / Next 15 / Firebase / Stripe) | N/A | N/A | Read-only archive | N/A | N/A | Superseded by `ADR-0001` (`D002`) |

---

## 2. Handoff Pack Coverage (`SERS_Handoff_2026-11-23/`)

All root documents, machine-readable records, and key source subdirectories inside `C:\Users\ANAS\Desktop\مشروع التخرج\sers-preview\SERS_Handoff_2026-11-23\` were read and verified (`PACKAGE_VALIDATION.json`: `61` sources registered, `81` source assets copied, `16` byte-identical duplicates collapsed, `0` missing paths, `0` hash mismatches):

### 2.1 Root Authoritative Documents (Read Complete)
| File | Exact Path (`...\sers-preview\SERS_Handoff_2026-11-23\...`) | Purpose & Key Verified Facts |
|---|---|---|
| `00_READ_FIRST_AR.md` | `00_READ_FIRST_AR.md` | Reading order, branch starting guidance (`#39` base, `#40`+`#41` reconciliation, `#42` obsolete), package layout |
| `SERS_MASTER_HANDOFF_AR_2026-11-23.md` | `SERS_MASTER_HANDOFF_AR_2026-11-23.md` | Authoritative 2026-11-23 synthesis: product definition, core vs extended scope, PR history `#1–#42`, R01–R22 summary, open decisions, test limits |
| `SERS_BRANCH_RECONCILIATION_AR.md` | `SERS_BRANCH_RECONCILIATION_AR.md` | Exact diff analysis: 24 overlapping + 31 PR #40-unique files, renderer version conflict (`PDF 5/DOCX 3` vs `PDF 2/DOCX 1`), PR #40 failure cause, PR #42 rejection rationale |
| `SERS_COMPLETION_BACKLOG_AR.md` | `SERS_COMPLETION_BACKLOG_AR.md` | `NEXT-01` through `NEXT-20` phased backlog (Stabilize, Live Ops Proof, Product Completion), evidence template |
| `SERS_AGENT_START_PROMPT_AR.md` | `SERS_AGENT_START_PROMPT_AR.md` | Transferable agent instructions and non-negotiable verification rules |
| `REPOSITORY_STATE.json` | `REPOSITORY_STATE.json` | GitHub branch protection (`protected: true`, 6 required checks, merge methods all true), PR #36–#42 SHAs, `ci_summary`, `source_scan` (`0` strong secret matches, 89 logs excluded) |
| `REQUIREMENTS_STATUS.json` | `REQUIREMENTS_STATUS.json` | Machine-readable status for `Reconciliation_2026-10_R01-R22` (22 unique IDs), `execution_provenance` caveat, `reference_urls` |
| `SOURCE_REGISTER.md` | `SOURCE_REGISTER.md` | 67-row source-to-package provenance map (`libfile_*` & Google Drive IDs -> local derivatives) |
| `CHECKSUMS.json` | `CHECKSUMS.json` | File integrity SHA-256 registry for handoff package |

### 2.2 Validation & Provenance Records (`records/`)
| File | Exact Path (`...\SERS_Handoff_2026-11-23\records\...`) | Coverage & Verified Metadata |
|---|---|---|
| `COLLECTION_LIMITS_AR.md` | `records\COLLECTION_LIMITS_AR.md` | Authoritative statement of evidence/collection limits (WhatsApp 171 msgs/220 rows, audio 982.152s, 11+1 Drive files, CI log read-only limits) |
| `DEDUPLICATION_AND_EXCLUSIONS.json` | `records\DEDUPLICATION_AND_EXCLUSIONS.json` | 16 byte-identical duplicates collapsed; 22 raw Office/patch/archive artifacts excluded in favor of safe text/JSON derivatives or `SERS_Source_2026-11-23` |
| `PACKAGE_VALIDATION.json` | `records\PACKAGE_VALIDATION.json` | Confirms `requirements_count: 22`, `sources_registered: 61`, `source_assets_copied: 81`, `source_archive_sha256: 9786273800c237bab5ea202b8b19b62d2ec56c876b3fed64ec3bc1486df49dc3` |
| `PR_INVENTORY.json` | `records\PR_INVENTORY.json` | 33 GitHub PRs (`#1–#13`, `#23–#42`; note `#14–#22` absent from PR collection — likely shared issue numbering, not deleted work) |
| `SOURCE_REGISTER.json` | `records\SOURCE_REGISTER.json` | Full metadata (`source_id`, `file_id`, timestamps, sizes, `included_paths`) for all 61 registered sources |
| `drive/*` | `records\drive\{DELIVERY_INDEX.md,delivery_validation.json,duplicate_map.json,redaction_log.json}` | Index, validation, dedup, and redaction log for the 12 Google Drive 2025/2026 historical docs |

### 2.3 Historical, Conversation, Competition, Design & Recent Subdirectories (`sources/`)
| Subfolder | Key Files Verified (`...\SERS_Handoff_2026-11-23\sources\...`) | Role & Weight in Hierarchy |
|---|---|---|
| `sources\historical\` | `SERS_Integrated_Audit_2026-10-06.md`, `SERS_Evidence_Reconciliation_and_Competitors_2026-10-07.md`, `SERS_First_Journey_Design_2026-10-08.md`, `SERS_Requirements_Coverage_2026-10-08.md`, `SERS_Audio_First_Requirements_Audit_v3.0.md`, `SERS_PreDesign_Deep_Competitive_Analysis_v1.0.md`, `SERS_PreDesign_Gate_Closure_v2.0.md`, `SERS_LowFi_Expert_QA_Usability_Test_Kit_v2.1.md`, `AI_HANDOFF.md`, `DECISIONS.md`, `PROJECT_STATUS.md`, `START_PROMPT.md`, `SERS_Staging_Audit_2026-10-30.html` | October/July/August audit, coverage, journey, and QA baselines; superseded on code status by `SERS_Source_2026-11-23/` + `PR #41`/`#40` |
| `sources\engineering_history\` | `SERS_Engineering_Blueprint_v1.txt` (from `.docx`), `SERS_Alignment_Historical_Traceability.json` (from `.xlsx`), `SERS_Analysis_Baseline_Literal_Review_v2.0_Redacted.md`, `SERS_Gate0_Audit_Matrix_v1.0.json`, `SERS_Gate0_Final_Audit_v1.0.txt` | Preserves `Blueprint:R01–R12`/`BR01–04`/`UC01–04` and `September:P0-001–035`/`A-001–027`/`F1–F8` namespaces |
| `sources\conversations\` | `SERS_Original_Requirements_Audio_Conflicts_Redacted.{md,json}`, `SERS_WhatsApp_Project_Transcript_Redacted.{md,json}`, `SERS_Transcript_Privacy_and_Provenance.json`, `SERS_Chat_Context_Excerpts.md` | Preserves `WhatsApp:REQ-WA-001–022`, `NFR-WA-001`, `AMB-WA-001–005`, and May–Jun 2026 WhatsApp logs (171 msgs / 220 rows) |
| `sources\audio\` | `SERS_WhatsApp_Audio_All_56.mp3` (982.152s) | Binary archive of 56 recordings (Parts 00–04 combined); not re-transcribed |
| `sources\competition\` | `SERS_Strategic_Competitive_Report_2026-10-02_Cited.md`, `SERS_Strategic_Competitive_Report_Provenance.json`, `SERS_Strategic_Competitive_Source_Links.json`, `Fawrn_Video_Reference_2026-10-02.png` | Historical Oct 2026 competitive benchmark (supplemented by live Nov 2026 web search) |
| `sources\design\` | `SERS_Wave1_Completion_Wave2_Spec_v2.0.md`, `SERS_Wave1_JTBD_UserFlows_Wireframes_v1.0_1_.md`, `SERS_Wave1_LowFi_Prototype_v1.0_1_.html`, `sers-wave1-wave2-qa-prototype.html` | 32-screen Low-Fi prototype (23 Wave 1 + 9 Wave 2, 74 transitions); UX flow baseline |
| `sources\early_drive\` | `read_00.md`, `02`, `03`, `04`, `05`, `07`, `13`, `16`, `27`, `31`, `34`, `36` (`UC-001–020`) | 2025/Jan 2026 graduation-project & early docs; secondary historical reference only |
| `sources\recent\` & `sources\recent_archives\` | `Manus_SERS_excerpt_2026-11-18.md`, `SERS_PR41_CI_AUDIT_2026-11-22.md`, `SERS_PR41_CI_FINAL_GREEN_2026-11-22.md`, `SERS_PR41_CI_REVIEW_AR.md`, `SERS_PR41_POST_PUSH_AUDIT_AR.md`, `SERS_Staging_Audit_2026-10-30.html`, plus PR41 review archive txt/md files | Nov 2026 CI review & audit provenance |
| `sources\previous_handoffs\` | `00_START_HERE*.md`, `01_PROJECT_MEMORY.md`..`08_PREVIOUS_WORK_REVIEW_PROTOCOL.md`, `NEXT_STEPS.md`, `README_AI.md`, `REPOSITORY_AUDIT_CHECKLIST.md`, `SOURCE_MANIFEST.md` | Aug 2026 memory packs |

---

## 3. Source Code, `docs/adr/`, `docs/vnext/`, `docs/phase1/`, and Patch Coverage (`SERS_Source_2026-11-23/` & Git)

Verified via `SERS_Source_2026-11-23/SOURCE_MANIFEST.json` (`original_tree_roundtrip_verified: true`, `delivered_tree_roundtrip_verified: true`) and direct `git show` against `sers-preview` (`e666157`, `70ee7d6`, `1e8a4e4`, `3204819`):

### 3.1 `docs/adr/` & `docs/operations/` (`main` `e666157` + PR #40 `1e8a4e4`)
- `docs/adr/0001-canonical-repository-and-migration-strategy.md` — Establishes `anas8273/sers-preview` as canonical repo, `Modular Monolith + Strangler Migration`, single relational MySQL source of truth, private Object Storage, immutable `WorkVersion` outputs, Store bounded context, and AI Gateway rules.
- `docs/operations/STAGING_RUNBOOK.md` & `docs/operations/TESTED_RUNTIME_RELEASE.md` — Staging & release runbooks (updated in PR #40).
- `docs/reviews/PR40_REVIEW_2026-11-10_AR.md` *(added in PR #40 `1e8a4e4`)* — Detailed review of PR #40 at `de0b0df`, Arabic identity/fonts/numerals/cover/mobile fixes, and CI verification commands.

### 3.2 `docs/vnext/` (`main` `e666157`, `00` through `15`)
| File | Coverage |
|---|---|
| `00_MASTER_RECONCILIATION.md` | Precedence hierarchy (§2.3), SERS product definition, Smart Evidence non-fabrication rules, Modular Strangler rules, Gates `G0–G5`, `DoD` |
| `01_REQUIREMENTS_TRACEABILITY.md` *(updated in PR #40)* | Baseline mapping of `R01–R22`, `P0-001–035`, `DELTA-01–10`, `F01–F20`, NFRs (Note: Oct 2026 statuses superseded by `REQUIREMENT_IMPLEMENTATION_MATRIX.md`) |
| `02_PHASE0_GATE_AND_BACKLOG.md` | `B01–B10` Phase 0 backlog |
| `03_DECISION_REGISTER.md` | `D001–D025` (Accepted/Proposed) & `O001–O012` (Open Decisions with blast radius & blockers) |
| `04_SOURCE_MANIFEST.md` | Source trust classification (`CODE`, `PR`, `DOC`, `AUDIO`, `VIDEO`, `OFFICIAL`, `CHAT`) and confidence tiers (`High`/`Medium`/`Low`) |
| `05_CONVERSATION_REQUIREMENTS_HARVEST.md` | `C-001–C-020` recurring constraints, `CONV-01–CONV-12` requirement deltas, 16 educator job titles, Upgrade IP/brand exclusion rules (`§6.2`), out-of-scope list (`§11`) |
| `06_REUSE_CATALOGUE_AND_SCOPE_FILTER.md` | Strangler disposition (`keep`/`adapt`/`migrate`/`retire`) for legacy pages |
| `07_PHASE_HANDOFF_2026-10-21.md` | Oct 21 phase handoff & PR #31 proof at `15ba7d5` |
| `08`–`12_B04_*.md` | Upload architecture, persistence, scope/quota gate, private storage contract, durable reception |
| `13_CORE_JOURNEYS.md` | Oct 28 core journeys (`#31–#32` integration notes) |
| `14_AUTH_RUNTIME_AND_OUTPUT_GATE.md` | Auth runtime, private output, and sharing gates |
| `15_AI_MEDIA_AND_LEGACY_SAFETY.md` | AI admission/policy, media limits, and legacy upload retirement |

### 3.3 `docs/phase1/` (Added in PR #41 `70ee7d6`)
Inspected in `PR41_70ee7d6_from_main.patch` and `git show 70ee7d6:docs/phase1/*`:
- `COMPREHENSIVE-RESULTS.md`, `PR41-CODE-REPAIRS.md`, `RESULTS.md`, `PROVENANCE.md`, `GITHUB-HANDOFF.md`
- `final-independent-review.md`, `independent-review.md`
- `report-integrity.md`, `sharing-audit.md`, `arabic-ux.md`, `http-security.md`, `exam-submission.md`, `dependencies.md`
- `screenshots/{home-1440.png,home-390.png,home-desktop.png,mobile-menu.png}`

### 3.4 Patch & Core Code Coverage (`PR40`, `PR41`, `PR42`)
- `patches/PR40_1e8a4e4_from_main.patch` (`1,263,033` bytes, SHA-256 `be599d07262c0be7994da14c212b86111921a5825c208fcc8753dba732a44853`, `55` changed files): audited 24 overlapping + 31 PR #40-unique files.
- `patches/PR41_70ee7d6_from_main.patch` (`1,978,475` bytes, SHA-256 `77b9ec0314a1c985072ba4eda6528d15852f7f06516a7095ca7058c5b07e70b0`, `179` changed files): audited `shared/report-projection.ts`, `shared/report-stale.ts`, `shared/online-exam-attempt.ts`, `server/work-report-draft-db.ts`, `server/report-draft-router.ts`, `server/work-version-inline-image.ts`, `server/work-version-output-service.ts`, `server/work-version-report-renderer.ts`, `server/work-version-docx-renderer.ts`, `server/public-output-service.ts`, `server/share-output-router.ts`, `server/domain-router.ts`, `server/domain-db.ts`, `server/account-db.ts`, `server/review-output-db.ts`, `server/ai-data-policy.ts`, `server/portfolio-version-guard.test.ts`, `client/src/pages/{WorkHub,WorkDetail,WorkReportEditor,CatalogPage,Store}.tsx`, `client/src/components/{ReportPdfActions,ReportShareActions}.tsx`, `drizzle/0020_closed_namor.sql`, `.github/workflows/*`, `package.json`, `.npmrc`.
- `patches/PR42_3204819_from_main.patch` (`3,995` bytes, SHA-256 `aa5ddb48f2d19e6be038c023619c899c7a3c94529cb0743647a5e51e51969e55`, `3` workflow files): verified superseded by PR #41.

---

## 4. Competitor & Alternatives Coverage (Role 3 Live Web + Local Audit, 2026-11-24)

All **17 named platforms** + **5 emerging/benchmark references** were audited via `SERS_Strategic_Competitive_Report_2026-10-02_Cited.md`, `SERS_PreDesign_Deep_Competitive_Analysis_v1.0.md`, and live `search_web` checks on 2026-11-24:
- **Verified Live (14):** `فورًا` (`fawrn.store`), `معياري` (`miyari.app`), `نماذج تعليمية` (`edu-forms.com`), `تحضيري` (`tahdiri.sa`), `كشوف` (`kushoof.net`), `توثيقي` (`tawthiqi.com`), `فرقد` (`farq.ai`), `سند المعلم` (`sanadforms.com`), `أثر` (`atharapps.com`), `شواهد` (`shawahd.sa`/`shawahid.sa`/`shawahede.com`), `Teachix` (`teachix.sa`), `نشِط` (Android/competitors), `بوابة التعليم الرقمية` (`edugate.moe.gov.sa`), `الخطة التشغيلية الذكية` (`usmartplan.com`).
- **Verified with Ambiguity / Multiple Entities (2):** `قيّم` (`gaeem.org` parent directory vs `tageem.net` teacher performance evaluation); `خطّط` (`khattit.com` verified in Oct 2026 local docs, offline/unindexed in Nov 2026 live search; similar `khotatty.org`).
- **Unverified Exact Domain (1):** `2wasl` (no active EdTech tool at `2wasl.com`/`2wasl.sa`; phonetic overlaps with `wasal.net`/`wisal-app.com` LMS & `tawasul.moe.gov.sa` — out of R5 scope).
- **Emerging / Global Benchmarks (5):** `منصة تميز الرقمية — ETEC` (`se.etec.gov.sa`), `المساعد الذكي للتقويم الذاتي المدرسي` (`tib-tan.org`), `أرحب`/`حرص`/`مدير` (`irheb.com`/`harsedu.com`/`e-modeer.com`), `وافي` (`wafy-ai.com`), `MagicSchool AI` (`magicschool.ai`) & `Brisk Teaching` (`briskteaching.com`).

---

## 5. Explicit Collection, Sandbox & Verification Caveats

1. **Out-of-Workspace Sandbox Boundary:** Subagents running with workspace `sers-preview` received `Permission denied` / timeout on `C:\Users\ANAS\Desktop\مشروع التخرج\sers-preview-reconcile`, `sers-preview-pr40-ref`, and historical `SERS`. Committed git objects (`70ee7d6`, `1e8a4e4`, `3204819`, `e666157`) were read directly via `git show` on `sers-preview`, while the **uncommitted partial reconcile edits** in `sers-preview-reconcile` (`shared/report-appearance.ts`, `shared/report-assets/`, `server/work-version-report-assets.ts`, `client/src/pages/work-report-fonts.css`, `shared/report-projection.ts`, `server/report-draft-router.ts`, `server/work-version-inline-image.ts`, `server/work-version-output-service.ts`, `TODO.md`) must be inspected directly inside `sers-preview-reconcile` prior to Batch 1 commits.
2. **Excluded Operational Logs:** `89` `.manus/db/db-query-*.json` operational query logs were excluded from `SERS_Source_2026-11-23/` per `SOURCE_MANIFEST.json`.
3. **Audio & Chat Collection Limits (`COLLECTION_LIMITS_AR.md`):** WhatsApp extract covers 171 messages (220 rows, May–June 2026); `SERS_WhatsApp_Audio_All_56.mp3` (982.152s) was NOT re-listened or re-transcribed, and the historical ASR transcript has unverified speaker attribution and a 30s gap (`876.46s–906.46s`). ChatGPT excerpts are targeted retrievals, not full verbatim exports.
4. **Drive PDF #12 & Raw Office Artifacts:** 11 of 12 Drive texts were extracted after PII redaction; the 12th PDF is linked only due to corrupted Arabic extraction order. Raw Office files were not visually re-checked.
5. **No Local Runtime Execution in R1/R2:** No tests, builds, or migrations were executed in this read-only coverage audit; CI results reflect GitHub Actions logs as of `2026-11-22T00:41Z`. Local Windows environment runs `node v24.14.1` (PR #41 specifies `engines.node >=22.12.0 <23`) and lacks `docker`, `mysql`, `clamd`, `qpdf`, `soffice`, and `pdftoppm` in PATH.
6. **Behind-Login Competitor Limits:** Competitor verification reflects public pages, app listings, and documented videos/audits—not interactive paid accounts.
