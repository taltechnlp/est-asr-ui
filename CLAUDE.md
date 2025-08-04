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

## Common Development Commands

```bash
# Install dependencies
npm install

# Generate Prisma client (run after schema changes)
npx prisma generate

# Apply database migrations
npx prisma migrate deploy

# Development server
npm run dev

# Build for production
npm run build

# Run production build locally
npm run preview

# Type checking
npm run check

# Linting
npm run lint

# Format code
npm run format
```

## High-Level Architecture

### Authentication System
The project recently migrated from Auth.js to Better Auth. The authentication system:
- Uses Better Auth with Prisma adapter (src/lib/auth.ts)
- Supports email/password and OAuth (Google, Facebook)
- Maintains backwards compatibility through hooks (src/hooks.server.ts)
- Session management uses both Better Auth sessions and a legacy session cookie for compatibility

### Database Structure
- **User**: Stores user accounts with roles (USER/ADMIN)
- **File**: Manages uploaded audio files and their transcriptions
- **Account/Session**: Better Auth tables for OAuth and session management
- **NfWorkflow/NfProcess**: Tracks Nextflow pipeline execution for transcription processing

### Key Application Flow
1. **File Upload**: Users upload audio files through `/files` route
2. **Processing**: Files are sent to external ASR backend via API calls
3. **Transcription Editing**: Interactive editor using TipTap with custom marks and nodes
4. **Export**: Transcriptions can be exported in various formats (DOCX, EST format)

### Important Integrations
- **ASR Backend**: External service for speech recognition pipeline
- **Email Service**: SendGrid/Mailjet for notifications
- **Audio Processing**: Uses ffmpeg and audiowaveform for waveform generation
- **Real-time Updates**: WebSocket/polling for transcription progress

### Directory Structure Highlights
- `/src/routes/[[lang]]/`: Internationalized routes (et, en, fi)
- `/src/lib/components/editor/`: TipTap editor components
- `/src/lib/adapters/`: File upload adapters for different services
- `/prisma/`: Database schema and migrations
- `/uploads/`: Local file storage for audio files

### Environment Configuration
Requires `.env` file with:
- DATABASE_URL for PostgreSQL connection
- AUTH_SECRET for Better Auth
- OAuth credentials (GOOGLE_CLIENT_ID, etc.)
- Email service credentials
- ASR backend API endpoints