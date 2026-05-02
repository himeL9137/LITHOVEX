# LITHOVEX AI

## Overview

LITHOVEX AI is an advanced autonomous AI coding agent. The backend runs on **Node.js (Express + TypeScript via tsx)** at port 8080. The React/Vite frontend is served by the Vite dev server on port 5000 (with `/api` proxied to 8080). All AI inference routes through Blackbox.ai (priority) → HuggingFace (fallback).

### Image Generation

When the **Image Generation** tool is toggled on in the homepage chat, the system routes to `/api/images/generate` which:
1. **Priority 1 — Blackbox.ai**: Uses the `BLACKBOX_API_KEY_1` from `LITHOVEX/server/blackbox_api_tokens.env`. Blackbox automatically selects the best available AI image model (FLUX, SDXL, Playground v3, etc.). No model validation needed.
2. **Priority 2 — HuggingFace** (fallback): Uses the HF token pool if Blackbox is unavailable. Requires a known diffusion model slug (FLUX.1-schnell default).

The image generation route is at: `LITHOVEX/artifacts/lithovex-ai-battle-mode/api-server/src/routes/images.ts`

**Run dev (frontend + backend together):** `cd LITHOVEX && pnpm dev`
- Vite dev server on port 5000 (with HMR) — what the user sees in the preview
- Express API on internal port 3001
- Vite proxies `/api/*` and `/uploads/*` → Express (`API_PROXY_TARGET` env var)
- Both processes run under `concurrently` and shut down together

**Run production:** `cd LITHOVEX && pnpm build && pnpm start`
- Builds the React frontend into `artifacts/lithovex-ai/dist/public/`
- Express serves the static build + API on port 5000 (single process, no proxy)

## UI / Design System

- **Font**: `Maple Mono` via `@fontsource/maple-mono` (installed in `artifacts/lithovex-ai`). Imported in `src/index.css` and applied globally via `--app-font-sans/serif/mono` CSS variables.
- **Button sizing**: The `Button` component (`components/ui/button.tsx`) uses `no-min-touch` to opt out of the global 44px touch-target rule. Individual small utility buttons (chip close buttons, tier filters, icon controls) also carry `no-min-touch` + `style={{ minHeight: 0 }}` to stay compact.
- **LITHOVEX Co-work model chips**: The chips row is a single horizontally-scrollable row (`overflow-x-auto`). Model chips have `shrink-0` so they never wrap to a second line. Max 6 models enforced via `toast()` (not `alert()`).
- **LITHOVEX Co-work toggle**: A switch in the chatbox lets selected models work TOGETHER sequentially (each agent builds on the previous draft, the final agent synthesizes one combined response) instead of in parallel. Toggle state persists in `localStorage` under `lithovex.cowork.enabled`. The collaborative output renders as a single `cowork`-type node with a stage timeline showing per-agent progress.

## Stack

- **Entry point**: `LITHOVEX/server/src/index.ts` (boots Express, listens on `PORT`)
- **Web framework**: Express 4 + TypeScript (run via `tsx`, NodeNext modules)
- **AI**: Hugging Face Inference Router (`https://router.huggingface.co/v1`) via the `openai` SDK (OpenAI-compatible base URL)
- **Token management**: `src/hf-manager.ts` — 8-slot HF token system with health monitor, auto-failover, active-token rotation
- **Web search**: DuckDuckGo HTML scrape (no third-party dependency)
- **Chat persistence**: SQLite via `better-sqlite3` (file: `LITHOVEX/server/data/lithovex.db`)
- **Uploads**: `multer` (memory storage, 16-file cap)
- **Streaming**: Server-Sent Events compatible with OpenAI streaming chunks
- **Frontend**: React 18 + Vite + Tailwind CSS (dark purple/indigo theme), built to `artifacts/lithovex-ai/dist/public/` and served by Express

## Directory Structure

```
LITHOVEX/
  server/                              # Node.js backend (workspace package @workspace/server)
    package.json                       # tsx + express + better-sqlite3 + multer + openai
    tsconfig.json                      # NodeNext, strict
    src/
      index.ts                         # Boot — listens on PORT (default 5000)
      app.ts                           # Express factory — mounts /api/* + static frontend
      hf-manager.ts                    # 8-token mgmt, health checks, failover, rotation
      db.ts                            # better-sqlite3 ChatStore (CRUD + JSON message blobs)
      routes/
        health.ts                      # GET /api/healthz
        chat.ts                        # POST /api/chat/completions (SSE) + /auto-evolve
        chats.ts                       # GET/POST/PUT/PATCH/DELETE /api/chats[/:id]
        tokens.ts                      # GET/POST /api/tokens/{status,switch,check}
        models.ts                      # GET /api/models (dynamic from HF Router + static fallback)
        upload.ts                      # POST /api/upload (multipart, field "files")
        search.ts                      # POST /api/search (DuckDuckGo HTML)
    data/                              # SQLite database lives here (gitignored)
  artifacts/
    lithovex-ai/                       # React + Vite frontend (workspace @workspace/lithovex-ai)
      src/
        pages/Home.tsx                 # Main page — welcome screen, chat, all state
        components/                    # ChatSidebar, TopBar, ChatMessageList, ChatInput,
                                       # SettingsPanel, ProjectExplorer, AutoEvolutionPanel, ...
        context/PlaygroundContext.tsx  # Multi-model state manager (useReducer)
        lib/types.ts                   # Core TypeScript interfaces
      dist/public/                     # Built output — served by Express
  pnpm-workspace.yaml                  # workspace packages: artifacts/*, lib/*, server
```

## API Endpoints

### Chat
- `POST /api/chat/completions` — OpenAI-compatible streaming (SSE) AI chat. Body: `model`, `messages`, `stream`, `temperature`, `top_p`, `max_tokens`, `hf_key_index`, `use_web_search`, `project_context`
- `POST /api/chat/auto-evolve` — Autonomous task planner. Body: `project_context`, `previous_tasks`, `model`, `hf_key_index`, `cycle_number`
- `GET /api/chats` — List all chats
- `POST /api/chats` — Create chat (body: `title?`, `messages?`)
- `GET /api/chats/:id` — Read single chat
- `PUT|PATCH /api/chats/:id` — Update chat (body: `title?`, `messages?`)
- `DELETE /api/chats/:id` — Delete chat
- `GET /api/healthz` — Health check (`{status:"ok"}`)

### Token Management
- `GET /api/tokens/status` — All 8 token health statuses (configured / healthy / lastError / preview)
- `POST /api/tokens/switch` — Switch active token (body: `index` 1–8)
- `POST /api/tokens/check` — Force health-check on all tokens

### Models
- `GET /api/models` — Dynamic model list from HF Router with static fallback

## AI Provider Priority (preflight)

The chat completions endpoint dispatches every non-tool request through `lib/provider-preflight.ts` in this strict order:

1. **Blackbox.ai (premium first-priority)** — every request first walks the full Blackbox key pool (`BLACKBOX_API_KEY_1..8`, file: `LITHOVEX/server/blackbox_api_tokens.env`). The preflight cycles through a curated list of Blackbox flagship chat models (`blackboxai/anthropic/claude-opus-4.7`, `claude-opus-4.6`, `claude-sonnet-4.6`, `openai/gpt-5.3-codex`, `google/gemini-3.1-pro-preview`, `x-ai/grok-code-fast-1:free`, `moonshotai/kimi-k2.6`, `z-ai/glm-5`, `minimax/minimax-m2.7`, `blackbox-pro`), trying every Blackbox key against each model in turn. Endpoint: `POST https://api.blackbox.ai/chat/completions` (OpenAI-compatible, `Authorization: Bearer <key>`). Verified against `GET /v1/models` for the active key. **Pro persona models** (LITHOVEX 2.6 Plus, LITHOVEX 2.5 Core, GPT-5.5, GPT-5.4 Pro, GLM 5, Kimi K2.6, MiniMax M2.7, Grok 4.1 Fast, Blackbox E2E Encrypted) all route through this same Blackbox preflight. The `requestedModel` is echoed back in the response payload's `model` field (via `PreflightOpts.requestedModel` in `provider-preflight.ts`) so the underlying Blackbox/HF model name is never leaked. LITHOVEX 2.6/2.5 are user-invented brand personas that always sort to the top of model pickers (`PREMIUM_9_MODELS` array order) and use a "best at everything" system prompt addon.
2. **Gemini** — every Gemini key in `GEMINI_API_KEY_1..N` is tried after Blackbox is exhausted. Keys rotate automatically on `401/403/429`.
3. **OpenRouter** — always attempted after Gemini is exhausted, regardless of task complexity. Cycles through a curated list of premium OR models (Claude Sonnet 4.6, GPT-4o, Gemini 2.5 Pro, DeepSeek R1, Llama-3.1 405B, Qwen 2.5 72B), trying every OR key against each model in turn.
4. **HuggingFace (deepest fallback)** — handled in `routes/chat.ts` via `runWithFailover`. Used for tool-using requests and as a final safety net after Blackbox + Gemini + OR all fail.

The user's selected persona (Claude Opus 4.7, Gemini 3.1 Pro, etc.) is enforced via the persona system-prompt prepended to `finalMessages` by `resolvePersona` — so whichever underlying provider/model actually answers, the assistant still "acts like" the chosen AI.

This same Blackbox → Gemini → OR → HF chain is wired into:
- **Regular chat** (`POST /api/chat/completions`) via `lib/provider-preflight.ts`.
- **LITHOVEX Co-work** — the `AgentCoWork.tsx` page (route `/agent-cowork`, with `/battle` kept as a legacy alias) calls the same chat endpoint, so it inherits the chain automatically. Supports both parallel mode (one response node per model) and co-work mode (sequential collaboration → single combined response node).
- **LITHOVEX Coder** (`POST /api/github/ai-edit`) via the `tryAiEditPreflight` helper in `routes/github.ts`. Because every coder request is a coding task, `analyzeTask` rates it `HIGH`/`EXTREME`, which means OR escalation is enabled whenever Gemini is exhausted.

### Files / Search
- `POST /api/upload` — Multipart `files` field; returns metadata + base64 preview for images
- `POST /api/search` — DuckDuckGo web search (body: `query`, `maxResults`)

## Environment Variables

| Variable | Description |
|----------|-------------|
| `HUGGINGFACE_API_KEY_1`–`_8` | The 8 rotating HF API keys (any subset can be set; unconfigured slots are skipped) |
| `HUGGINGFACE_API_KEY` | Fallback single key (used as slot #1 if `_1` is unset) |
| `DEFAULT_MODEL` | Default model ID (default: `Qwen/Qwen3-8B`) |
| `PORT` | Server port (default: 5000) |
| `NODE_ENV` | `development` / `production` |

## UI Theme

- Background: `#121212`
- Sidebar/panels: `#1a1a1a`
- Accent gradient: `#7c3aed → #6d28d9` (purple → indigo)
- Font: Inter (Google Fonts)
- Animations: fadeInUp, slideInLeft, logoGlow, typingBounce

## Key Features

- **8-Token System**: Click any key in Settings → API Keys tab to switch; auto-failover on rate limits / 5xx errors
- **Model Library**: Searchable model catalogue, filterable by tier (fast/expert), grouped by provider
- **Settings Panel**: Slide-in right panel with 4 tabs — Model, API Keys, Parameters, Tools
- **Welcome Screen**: Hero logo, feature cards, suggestion prompts shown before first chat
- **AUTO CODE Mode**: Continuously iterates AI responses until `[AUTO CODE COMPLETE]` token
- **Auto-Decision Mode**: Autonomous planning loop with evolution cycles (`/api/chat/auto-evolve`)
- **Web Search**: DuckDuckGo toggle per chat (server-side scraping)
- **Project Explorer**: Attach project context to chat
- **Chat History**: SQLite-persisted (`server/data/lithovex.db`), browsable sidebar
- **Multi-Model Playground**: `/playground` route with parallel model execution
- **Contact Support**: Top-bar "Support" button (also in mobile overflow menu) opens `ContactSupportModal` which composes the user's message and opens WhatsApp (`https://wa.me/8801989379895`) pre-filled, sending the issue to the support number `01989379895` (BD: `+880 1989-379895`).

## Multi-Model Playground Architecture (Phases 1–6)

### Phase 1 — Global State (Complete)
- `src/lib/types.ts`: Full TypeScript type system — `FileMeta`, `AIResponseState`, `MessageTurnNode`, `PlaygroundConversation`, `ModelConfig`, `PlaygroundEnvironment`, `PlaygroundContextValue`
- `src/context/PlaygroundContext.tsx`: `useReducer`-based context with `PlaygroundProvider` and `usePlaygroundState()` hook
  - Model management: add/remove/reorder/update-params, 8 round-robin color themes
  - Turn node management: `initResponseShell` → `streamChunk` → `finalizeResponse`; each model stream isolated
  - All state mutations immutable; callbacks `useCallback`-memoised; context value `useMemo`-memoised
  - NON-DESTRUCTIVE: legacy `Home.tsx` chat flow is untouched

### Phase 2 — App Shell (Complete)
- `TopNav.tsx`: Sticky global top nav with Framer Motion sliding underline active state, Settings, profile dropdown (full ARIA / keyboard)
- `PlaygroundLayout.tsx`: CSS Grid shell, transparent in legacy mode, full shell on `/playground`, collapsible `<aside>`
- `PlaygroundPage.tsx`: `/playground` route placeholder

### Phase 3 — Model Selector System (Complete)
- `useDebounce.ts` (300ms generic debounce)
- `ModelDropdown.tsx`: Fixed-position picker with viewport edge detection, Framer Motion entrance, categorized list, keyboard nav
- `ModelSelectorManager.tsx`: Animated colored pills + add/remove + 6-model warning

### Phase 4 — Hyper-Parameter Configuration (Complete)
- `ModelSettingsModal.tsx`: Window-boundary aware popover; custom `RangeSlider` (transparent native + custom track/thumb in model color); Temperature / Max Tokens / Top-P sliders; provider sub-dropdown; tooltips; remove-from-chat button
- `ModelSelectorManager.tsx` updated: pill body opens settings modal, ✕ removes directly

### Phase 5 — System Persona & Instruction Manager (Complete)
- `usePersonaManager.tsx`: `localStorage` CRUD (`lx-personas`, `lx-active-persona-id`), 3 built-in defaults
- `PersonaManagerModal.tsx`: Two-pane modal with auto-resizing instructions textarea, ⌘S shortcut, set-active toggle, delete (non-built-in)
- `PlaygroundPage.tsx`: Persona toolbar button + active persona banner + empty state CTA

### Phase 6 — Playground Composer (Complete)
- `PlaygroundComposer.tsx`: Auto-grow textarea, file attachments (drag-and-drop, image previews, 8 cap), quick-action chips, send/stop morph button, ⌘S hint
- `PlaygroundPage.tsx`: derives `isGenerating` from response statuses, wires composer → `appendTurnNode` + `initResponseShell` per active model

## Build & Run

After source code changes to the React frontend, rebuild:
```bash
cd LITHOVEX
PORT=5000 BASE_PATH="/" pnpm --filter @workspace/lithovex-ai run build
```

Then restart the server workflow.

## Premium Persona Backend Wiring (Apr 2026)

The frontend `PREMIUM_9_MODELS` (in `lithovex-ai/src/lib/ai-models-config.ts`) exposes 9 virtual model IDs in the picker (Claude Opus 4.7, Gemini 3.1 Pro, GPT-5.5, GPT-5.4 Pro, Sonnet 4.6, DeepSeek-R1, OpenAI o3, Grok 4.1 Fast, Kimi K2.6). These IDs are NOT real HF Router models — they require server-side translation.

**Backend resolver** (`api-server/src/lib/model-registry.ts`):
- `PREMIUM_PERSONAS` map — for each of the 9 persona IDs holds:
  - `systemAddon`: persona-flavored system prompt appended to LITHOVEX_CORE_SYSTEM_PROMPT
  - `routing`: per-`TaskType` real HF model (vision → Qwen-VL-72B, math → DeepSeek-R1, coding → Qwen-Coder-32B, etc.)
- `isPremiumPersona`, `resolvePremiumPersona`, `getPremiumPersonaPrompt` helpers
- Unified `resolvePersona(modelId, prompt) → { underlyingModel, systemPrompt }` that handles both LITHOVEX-branded aliases and premium personas — single chokepoint used by `chat.ts`
- `PREMIUM_PERSONA_COUNT = 9` added to `MODEL_COUNT`

**`chat.ts`** now calls `resolvePersona()` instead of `isLithovexAlias`/`resolveLithovexAlias`/`getLithovexPersonaPrompt`.

`hf-keys.ts` `maxSlots` defaults bumped 9 → 11 as a forward-looking cap (env file currently holds 9 slots; missing slots are skipped). `chat.ts` `preferredIdx` clamp matches.

## Model-Identity Intercept (Apr 2026)

When a user asks an identity question — "what model are you?", "which AI is this?", "are you GPT?", "introduce yourself", etc. — the chat route returns a **canonical, hard-coded** identity statement based on the currently selected model, bypassing the AI entirely so the answer never drifts.

**File**: `api-server/src/lib/model-identity.ts`
- `isIdentityQuestion(text)` — regex bank covering "what/which model/AI/LLM are you", "what's your model/name/version", "are you gpt/claude/gemini/qwen/llama/...", "what powers you", "who are you", "introduce yourself".
- `PERSONA_IDENTITIES` — fixed table for all 11 selectable personas (2 LITHOVEX brand aliases + 9 premium personas) with canonical name, provider, and "best at" strengths blurb.
- `PROVIDER_BY_NAMESPACE` — maps every HF namespace (qwen, deepseek-ai, meta-llama, google, microsoft, mistralai, etc.) to a clean provider name.
- `inferStrengths(idLower)` — heuristic per-task-type strengths blurb covering coder/math/vision/whisper/tts/sdxl/video/ocr/detection/sentiment/translation/summary/safety/function-calling/long-context/thinking/multilingual/general models.
- `buildIdentityAnswer(modelId)` returns: `"I am <Provider> <Name> running on LITHOVEX AI. I'm best at <strengths>"`. Title-cases lowercase tokens, preserves uppercase ones (FLUX.1, GPT, 70B, V3), dedupes when name starts with provider word ("Meta Llama" not "Meta Meta Llama"), drops provider prefix for LITHOVEX-branded personas.

**Wiring**: `api-server/src/routes/chat.ts` calls `isIdentityQuestion(taskPrompt)` immediately after the creator-question intercept and returns via the existing `streamCannedAnswer` / `jsonCannedAnswer` paths. This deliberately overrides the "Identity Confidentiality" rule in `system-prompts.ts` for identity questions only; everything else still flows to the AI unchanged.
