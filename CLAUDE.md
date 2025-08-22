# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the EST-ASR-UI project (https://tekstiks.ee), a full-stack Estonian speech transcription web application built with:
- **Framework**: SvelteKit 5 with Svelte 5
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4 with DaisyUI
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Better Auth (recently migrated from Auth.js)
- **Text Editor**: TipTap for transcription editing
- **AI Integration**: LangChain with OpenRouter for transcript analysis
- **Runtime**: Node.js/Bun support

## Common Development Commands

```bash
# Install dependencies
npm install

# Database setup and management
npx prisma generate              # Generate Prisma client after schema changes
npx prisma migrate deploy        # Apply database migrations
docker compose up -d             # Start PostgreSQL database

# Development workflow
npm run dev                      # Start development server with --host
npm run dev -- --open          # Start dev server and open browser

# Production builds
npm run build                    # Build for production
npm run preview                  # Preview production build locally
npm run prod                     # Run production server
npm run prelive                  # Run pre-live server

# Code quality
npm run check                    # TypeScript type checking
npm run check:watch             # Watch mode for type checking
npm run lint                     # ESLint + Prettier check
npm run format                   # Format code with Prettier
```

## High-Level Architecture

### Authentication System
**Dual Authentication Setup**: Recently migrated from Auth.js to Better Auth while maintaining backward compatibility:
- **Better Auth** (`src/lib/auth.ts`): Primary authentication with Prisma adapter
- **Legacy Support** (`src/hooks.server.ts`): Maintains compatibility with existing session cookies
- **Providers**: Email/password authentication + OAuth (Google, Facebook)
- **Session Management**: Unified session handling through `event.locals.auth()`

### Core Database Models
- **User**: Account management with roles (USER/ADMIN), supports both Better Auth and legacy sessions
- **File**: Central entity for uploaded audio files and transcription metadata
- **Account/Session**: Better Auth tables for OAuth and session persistence  
- **NfWorkflow/NfProcess**: Tracks Nextflow pipeline execution and transcription processing status
- **ChatSession**: Stores AI-powered transcript analysis conversations
- **TranscriptSummary**: AI-generated summaries with multi-language support
- **AnalysisSegment**: Incremental transcript analysis with improvement suggestions

### Application Architecture Flow

#### File Processing Pipeline
1. **Upload** (`/files`): Audio file upload with validation and metadata extraction
2. **ASR Processing**: External speech recognition via EST-ASR-Backend API calls
3. **Nextflow Integration**: Pipeline monitoring through NfWorkflow/NfProcess models
4. **Real-time Updates**: Progress tracking and notifications during transcription

#### Transcript Enhancement System
1. **TipTap Editor** (`/src/lib/components/editor/`): Rich text editing with custom marks/nodes
2. **AI Analysis** (`/src/lib/agents/`): LangChain-powered transcript improvement using:
   - `transcriptAnalyzer.ts`: Segment-by-segment analysis
   - `summaryGenerator.ts`: Document summarization  
   - `coordinatingAgent*.ts`: Multi-agent coordination
3. **Export Pipeline**: Multiple format support (DOCX, EST format)

### Critical Integrations

#### External Services
- **EST-ASR-Backend**: Primary speech recognition pipeline
- **OpenRouter API**: LLM services for transcript analysis (via LangChain)
- **Email Services**: SendGrid/Mailjet for notifications
- **Audio Processing**: ffmpeg + audiowaveform for waveform generation

#### Internationalization
- **Route Structure**: `[[lang]]` pattern supporting et/en/fi languages
- **Multi-language Support**: Both UI and transcript content localization

### Key Technical Patterns

#### Route Architecture
- **API Routes** (`/src/routes/api/`): RESTful endpoints for file operations, transcription, and analysis
- **Page Routes** (`/src/routes/[[lang]]/`): Internationalized user interface
- **Authentication Flow**: Better Auth integration at `/api/auth/[...all]`

#### State Management
- **Server-Side**: Prisma ORM with PostgreSQL
- **Client-Side**: Svelte 5 reactivity + Dexie for offline storage
- **Real-time**: Progress polling for long-running operations

### Development Environment

#### Required Dependencies
- **System**: Node.js (16.x/18.x tested), ffmpeg, audiowaveform, python3
- **Database**: PostgreSQL (via Docker or local installation)
- **External APIs**: EST-ASR backend, OpenRouter API key

#### Environment Variables (`.env.example`)
- **Database**: `DATABASE_URL` for PostgreSQL connection
- **Authentication**: `AUTH_SECRET`, OAuth client credentials
- **External Services**: ASR backend URLs, OpenRouter API key, email service credentials
- **File Storage**: Upload directories and processing pipeline paths