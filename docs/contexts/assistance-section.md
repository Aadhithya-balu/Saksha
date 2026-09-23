# Saksha — ASSISTANCE Section (`docs/contexts/assistance-section.md`)

> Runtime section label: **ASSISTANCE** (sidebar `NavGroup label:
> 'ASSISTANCE'`). Operator-facing AI assistance: the national-level RAG chat
> assistant and the face-recognition live capture tool.

| Page (route)                     | Docs section |
| -------------------------------- | ------------ |
| AI Chat — `/ai-chat`             | §2 |
| Face Recognition — `/face-recognition` | §3 |

---

## 1. Section overview

### 1.1 Pages (`datathon/src/components/layout/Sidebar.tsx`)

| id                | label             | path                  | icon               |
| ----------------- | ----------------- | --------------------- | ------------------ |
| `ai_chat`         | AI Chat           | `/ai-chat`            | `MessageSquareText`|
| `face_recognition`| Face Recognition  | `/face-recognition`   | `ScanFace`         |

### 1.2 Route-level access (`useRBAC.ts`)

| Route | Allowed roles | Notes |
| ----- | ------------- | ----- |
| `/ai-chat` | all 7 (`INSIGHT_ROLES`) | read-only assistant for every role |
| `/face-recognition` | ADMIN, SCRB, IO, INSPECTOR, FORENSIC (`FACE_OPS_ROLES`) | SP and VIEWER excluded |

`PRIMARY_BY_ROLE` pins: every role except ADMIN pins `ai_chat`
(ADMIN's pin set covers the six pages named in the original request — AI Chat
appears under this ASSISTANCE section, see `home-section.md` §4).

### 1.3 Backend conventions (both pages)

- `routes/ai_chat.py` → `prefix="/ai/chat"`, `ALL_ROLES`.
- `routes/face_recognition.py` → primary router guarded
  ADMIN, SCRB, IO, INSPECTOR, FORENSIC; a **separate public router**
  (`face_recognition.py:183`) exists for unguarded/internal endpoints — never
  widen the guarded one.
- Chat answers are never hardcoded: hosted-LLM answers come from
  extraction + retrieval + backend fetchers (`AGENTS.md`); district-bound users
  get sentinel `__NO_DISTRICT_ACCESS__` handling in the orchestrator
  (Phase 5 scoping).

---

## 2. AI Chat (`datathon/src/pages/AIChat.tsx`)

### 2.1 What's on the page

- **Header** — assistant title + status dot, `ScrollToBottom` control when
  messages overflow.
- **Message list** — user bubbles right, assistant bubbles left with
  `MarkdownRenderer` body + citation chips (`CitationBadge`: source title,
  ref type/id, optional `entity_name`/`entity_type`, `has_more` detail expander
  showing `sections[]` snippet text).
- **Streaming states** — "Thinking…"/`Analyzing` while `status: 'working'`,
  a `final` message flips to done; `notice` chunks render system notes
  (e.g. district sentinel).
- **Composer** — textarea auto-grow, send button (disabled while streaming),
  stop/regenerate affordances for temp threads, suggested `FOLLOW_UPS` chips
  below the last assistant message (grouped by `intent`/classification from
  last response metadata), **welcome prompts** (6 quick-start cards) when the
  thread is empty.
- **Sidebar rail** — conversation list (title, relative time, active state),
  "New Chat", per-item delete; `ImportOutlined` import/export of thread JSON.

### 2.2 How it's done

- **Streaming transport** — `chatQueryStream(body, onChunk)` in
  `services/aiChat.ts`: `POST /api/ai/chat` (SSE-style chunk stream over fetch);
  each chunk has `status` (`working|final`), `meta`, `token`, `final`, `notice`.
  Assembled into assistant messages client-side; `meta.intent`,
  `meta.follow_ups`, `meta.citations`, `meta.conversation_id` drive UI state.
- **Conversation CRUD** — `listConversations`, `getConversation`,
  `createConversation`, `renameConversation`, `deleteConversation`, `appendMessage`
  (backend `routes/ai_chat_history.py`, `ALL_ROLES`).
- **History** — threads + active thread id persisted in
  `localStorage['saksha_chat_last']`; temp (unsaved) threads are local-only and
  **regenerate is only enabled for temp threads** (saved threads append
  server-side instead).
- **Context scope** — district from `useUserScope` sent in the request body
  (district-scoped RAG + backend fetchers; Phase 5).
- **Audit** — every user send logs `addLog('REVIEW', …)` via `useAuditStore`
  (existing convention: chat activity is a review-type action).

### 2.3 Current behaviour

- On mount: restore `saksha_chat_last`, list conversations, reconnect if
  `auth:session-expired` fired elsewhere (window event listener reloads session
  state).
- Send → optimistic user bubble → stream → citations/follow-ups attach to the
  assistant bubble → conversation_id saved on first `meta` → list refresh.
- Errors: stream failure shows a retry affordance on the failed assistant
  bubble; 401 dispatches `auth:session-expired`.
- **No in-page role gating** — all 7 roles get identical UI; content differences
  come from server-side district scoping and role-aware fetchers only.
  Deterministic rule answers are labelled rule-based in the response payload.

### 2.4 Role behaviour

| Role | Page | Send | Conversation CRUD | District scope |
| ---- | :--: | :--: | :---------------: | -------------- |
| ADMIN | ✅ | ✅ | ✅ (own threads) | state-wide / own district |
| SCRB, IO, INSPECTOR | ✅ | ✅ | ✅ | district or all |
| SP | ✅ | ✅ | ✅ | district or all |
| FORENSIC | ✅ | ✅ | ✅ | district or all |
| VIEWER | ✅ | ✅ | ✅ | district / restricted fetchers |

All via `ALL_ROLES` chat routers; differences are purely server-side data
visibility.

---

## 3. Face Recognition (`datathon/src/pages/FaceRecognition/index.tsx`)

### 3.1 What's on the page

- **Setup state** — camera selector (enumerateDevices), permission prompt,
  fallback "choose file" mode, supported-features note (blink/liveness when
  available).
- **Capture state** — live `video` preview, capture shutter (or upload-drop),
  frame QC overlay (size/brightness/blur), "Analyzing" progress state.
- **Results** — matched reference card (name, station, confidence %, rank),
  near-miss list, no-match empty state, liveness verdict (when supported),
  "register lead" prompt wording — matches are **proposed leads requiring human
  confirmation** (never auto-confirm).
- **Session panel** — per-session stats (frames, matches, avg confidence),
  session history list, export session JSON.
- **Recent matches** — table: timestamp, matched name, confidence, badge/station,
  disposition (Pending/Confirmed/Rejected) with confirm/reject buttons
  (review-gated).

### 3.2 How it's done

- **Frontend** — `services/faceRecognition.ts` wrappers:
  `getFaceSession`, `startFaceSession`, `uploadFaceFrame`,
  `getFaceSessionMatches`, `reviewFaceMatch(sessionId, matchId, decision)`,
  `endFaceSession`. Frame upload is multipart; responses stream analysis state.
  Reference images load from disk per-process cache (`_cached_references`) —
  the matching path is DB-independent after seeding (`AGENTS.md`).
- **Backend** — `routes/face_recognition.py`:
  - Guarded router: ADMIN, SCRB, IO, INSPECTOR, FORENSIC.
  - Public router (`:183`) for internal/unauthenticated probes — do not expose
    stored paths; demo faces are served via logical refs only (`AGENTS.md`).
  - Session/match review endpoints use `REVIEW_ROLES` (admin, crime_analyst,
    investigator, inspector) for disposition changes.
- **Resource hygiene** — embedding cache + session release on completion
  (historical pool-exhaustion fix; see AGENTS "Recent sessions summary").
- **Audit** — confirmations/rejections logged via `addLog('REVIEW', …)`.

### 3.3 Current behaviour

- Start session → camera stream → manual/auto capture → frame POST → match list
  updates → operator confirms or rejects each proposed lead.
- Sessions are server-tracked; ending the session releases worker resources.
- Errors (no camera, denied permission, unsupported) fall back to file upload or
  show inline guidance; "Analyzing" spinner persists until the backend returns.

### 3.4 Role behaviour

| Role | Page | Capture/upload | Review (confirm/reject match) |
| ---- | :--: | :------------: | :---------------------------: |
| ADMIN | ✅ | ✅ | ✅ |
| SCRB, IO, INSPECTOR | ✅ | ✅ | ✅ |
| FORENSIC | ✅ | ✅ | ❌ (backend `REVIEW_ROLES` excludes forensic) |
| SP | ❌ (route) | — | — |
| VIEWER | ❌ (route) | — | — |

---

## 4. Cross-cutting notes

- Both pages must preserve the "proposed lead / human review" posture: chat cites
  sources rather than asserting facts; face matches require explicit disposition
  actions before they count as confirmed.
- Chat streaming failures and face-session release regressions have dedicated
  test coverage (chat streaming pre-existing failures out of scope per AGENTS).
- Do not surface internal storage paths from either page.

<!-- Docs set: home · investigations · intelligence · analysis · assistance ·
ai-processing · reports · system. -->