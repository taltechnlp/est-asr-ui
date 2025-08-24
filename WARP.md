# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

Project: EST-ASR-UI (tekstiks.ee) — a full-stack Estonian speech transcription web app built on SvelteKit 5 with TypeScript, Tailwind CSS v4, Prisma/PostgreSQL, and Better Auth. It integrates with an external ASR backend and OpenRouter LLMs for transcript analysis.

- Tech stack: SvelteKit 5, TypeScript, Tailwind v4 (+ DaisyUI), Prisma ORM, PostgreSQL, Better Auth, TipTap editor, LangChain/OpenRouter, Vite 6, Bun/Node runtime
- System prerequisites: Node.js LTS (16.x/18.x tested), Docker (for Postgres), python3, ffmpeg, audiowaveform
- Ports: Web dev 5173, Postgres 4123->5432 (via docker compose)


Common commands

- Install dependencies
  - npm install

- Environment setup
  - cp .env.example .env
  - Adjust DATABASE_URL and other secrets; only variables prefixed with VITE_ are exposed to the client

- Database (PostgreSQL via Docker + Prisma)
  - docker compose up -d
  - npx prisma migrate deploy      # apply existing migrations
  - npx prisma generate            # (re)generate Prisma client after schema changes

- Development server
  - npm run dev                    # starts Vite dev server (uses --host)
  - npm run dev -- --open          # open browser automatically

- Build and preview
  - npm run build                  # production build
  - npm run preview                # preview built app locally

- Production (uses adapter-node build output)
  - npm run prod                   # runs build/index.js with Bun and ORIGIN/PORT/HOST env from script
  - npm run prelive                # pre-live configuration

- Code quality
  - npm run lint                   # Prettier check + ESLint
  - npm run format                 # Prettier write
  - npm run check                  # svelte-check (TypeScript)
  - npm run check:watch            # watch mode

- Tests (Vitest)
  - Tests are written for Vitest (see tests/positionBasedReplacement.test.ts). If Vitest isn’t installed, add it: npm i -D vitest
  - Run all tests: npx vitest run
  - Run a single file: npx vitest run tests/positionBasedReplacement.test.ts
  - Filter by test name: npx vitest run -t "Position-Based Text Replacement"

- Tooling integration scripts (Node -> Python bridges)
  - node scripts/test_nodejs_integration.js
  - node scripts/test_signal_integration.js
  - node scripts/test_summary_recovery.js


High-level architecture

- Runtime and build
  - SvelteKit with @sveltejs/adapter-node (svelte.config.js). The production server is produced under build/ and started via build/index.js (see package.json prod/prelive scripts).
  - Vite configuration (vite.config.ts) enables Tailwind v4 plugin and SvelteKit. Tailwind’s theme, DaisyUI, and typography/forms plugins are configured in tailwind.config.ts. PostCSS uses autoprefixer.
  - Aliases in svelte.config.js: components -> $lib/components, utils -> $lib/utils.

- Authentication
  - Primary: Better Auth (src/lib/auth.ts) with Prisma adapter and models (Account, Session, Verification, User).
  - Compatibility shim: src/hooks.server.ts injects event.locals.auth() using Better Auth session first; if absent, falls back to a simple cookie-based session for legacy compatibility. This unifies downstream usage across server routes and endpoints.

- Data layer (Prisma/PostgreSQL) — prisma/schema.prisma
  - Core models
    - User (roles: USER/ADMIN)
    - File: uploaded audio files, transcription text/metadata, relations to workflows and analyses
    - NfWorkflow / NfProcess: track Nextflow pipeline runs and process-level metrics/status
    - ChatSession: stores analysis conversations for a File and User
    - TranscriptSummary: AI-generated summary and key topics (plus UI-language variants)
    - AnalysisSegment: per-segment analysis, position/time ranges, suggestions and N-best alternatives
  - DATABASE_URL from .env controls the connection (Postgres by default). Note docker-compose.yml maps local port 4123 to container 5432.

- Routes structure (SvelteKit)
  - src/routes/[[lang]]/...: Internationalized UI pages (et/en/fi) for upload, file detail, auth, admin resume, logging, profile, etc.
  - src/routes/api/...: Server endpoints
    - auth/[...all]: Better Auth endpoints
    - files, uploaded/[fileId]: File upload/access
    - transcribe: Proxy/orchestrate ASR processing against external backend; includes helpers and progress types
    - transcript-analysis: Segment extraction, position-based analysis, auto-analyze, progress endpoints
    - transcript-summary: Generation and retrieval per file
    - reset/signin/signout/user: Account flows
    - log-events: Client logging ingestion

- Editor and transcript processing (TipTap + ProseMirror)
  - src/lib/components/editor: TipTap editor components (Tiptap.svelte, TiptapAI.svelte) and editor UI (toolbar, nodes, marks, plugins)
    - Custom nodes/marks for words, speakers, diff highlighting
  - src/lib/services: Core position- and transaction-aware text operations used by the editor and tests
    - positionAwareExtractor(.ts|AI.ts): extract segments with absolute positions and metadata
    - positionMapper.ts / TransactionReconciler: map positions across document changes and reconcile suggestions
    - transcriptTextReplace* variants: multiple strategies for safe text replacement in ProseMirror docs
    - editReconciliation.ts: tracks pending edits, applies/reconciles them with confidence
  - tests/positionBasedReplacement.test.ts validates the end-to-end flow of extraction → LLM suggestion mapping → reconciliation.

- Agents and AI integration
  - src/lib/agents: coordinating agents that orchestrate tools and LLMs for transcript improvements and summarization
    - coordinatingAgent*.ts variants and prompts/schemas for transcript analysis
    - tools/:
      - phoneticAnalyzer.ts and python bridge scripts for phonetic similarity checks
      - signalQualityAssessor.ts + python bridge for SNR/quality categories and strategy thresholds
      - positionAwareTiptapTool.ts and tiptapTransaction*.ts for editor-aware operations
      - asrNBestServerNode.ts, webSearch.ts (aux utilities)
  - src/lib/llm: OpenRouter integration for LangChain prompting and direct calls
  - Environment: OPENROUTER_API_KEY and ASR backend URLs are read from .env

- Internationalization
  - Route pattern [[lang]] with language packs under src/lib/i18n (et, en, fi) and translation bootstrap in index.ts.

- Logging
  - src/lib/logging: client-side event collection with a web worker (log.worker.ts) and server ingestion at routes/api/log-events.

- Email and downloads
  - src/lib/email.ts for SMTP providers (SendGrid/Mailjet supported by dependencies), src/lib/download.ts for export flows (DOCX and EST formats via converters under src/lib/helpers/converters).

Notes and caveats

- Node/Bun: The production scripts use Bun to run the built server (bun run build/index.js). Ensure Bun is installed if using npm run prod/prelive. Node 18+ also supports the adapter-node output if you prefer running with node build/index.js (adjust scripts accordingly if you change runtime).
- Audio preprocessing: For efficient waveform rendering, the server expects ffmpeg and audiowaveform to be available on PATH.
- .env consistency: docker-compose.yml sets POSTGRES_USER/POSTGRES_PASSWORD to prisma/prisma. The sample .env uses postgres/postgres@localhost:4123. Align these to avoid connection issues.

