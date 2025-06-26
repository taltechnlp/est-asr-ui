# ASR UI

This project is a fullstack web application that powers the publically available Estonian speech transcription service [https://tekstiks.ee](https://tekstiks.ee). It is built using the SvelteKit web framework and written mainly in TypeScript. The application provides an interactive user interface for editing speech transcriptions.

The server-side part relies on Prisma ORM to interact with a database. The database is used to store basic user data and metadata about the transcribed files. The audio files and transcription are presumed to be stored on a disk. The currently used database is PostgreSQL but it is possible to switch to MySQL or MongoDB which are also supported by Prisma although minor schema changes might then be required.

## Speech Recognition

For speech recognition the [https://tekstiks.ee](https://tekstiks.ee) service makes API calls to another [web server](https://github.com/taltechnlp/est-asr-backend) that executes the [transcription pipeline](https://github.com/taltechnlp/est-asr-pipeline) and return results afterwards.

## Installation

Npm packages can be downloaded using the command `npm install`. It will install all the dependencies defined in the file `package.json`.

In order to configure the system, a `.env` file must be created, an example is provided. Among other parameters it contains a database connection string.

The database should be installed locally or via a Docker container. A docker-compose file is provided and should then be put into daemon mode with the command:
`docker compose up -d`

When using the Docker container, a database is created and a user is created. The connection string in `.env` must match with database IP, port, user and database name. Then finally, the `prisma/migrations` folder contains SQL scripts that must be executed in order to generate the necessary DB schema. This can be done by running `npx prisma migrate deploy`.

Prisma is able to generate an API to interact with the database. After the initial schema creation and after any change to the schema, a new API should be generated. Prisma is installed locally with other npm packages. To execute it use the following command:

`npx prisma generate`

The audio player consumes much less memory if the soundwave is generated server-side. For this `python`, `ffmpeg` and `audiowaveform` have to be available in path as both are executed. Instructions for installing Audiowaveform: https://github.com/bbc/audiowaveform . 

Node LTS versions can be used only. 16.x and 18.x have been tested. 

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

## Deployment

To deploy the `npm run prod` should be provided with appopriate enviroment variables. Teksiks.ee is using the Nginx reverse proxy to configure the public name and TLS certificates.

## Features

- **ASR Transcription**: Upload audio files and get automatic transcriptions
- **Interactive Editor**: Rich text editor with speaker segmentation and word-level timestamps
- **Real-time Collaboration**: Multiple users can edit transcripts simultaneously
- **Export Options**: Download transcripts in various formats (JSON, SRT, TXT)
- **Multi-language Support**: Estonian, English, and Finnish interfaces
- **AI-Powered Transcript Refinement**: Advanced LLM integration for error detection and correction

## AI Agent Integration

### Transcript Refinement Workflow

The application now includes a sophisticated AI agent pipeline for automatic transcript refinement:

#### Components:
- **NER Analysis**: Named Entity Recognition to identify proper nouns, organizations, and locations
- **OpenRouter LLM Integration**: Real-time analysis and correction suggestions using Claude 3.5 Sonnet
- **Error Detection**: Automatic identification of potential ASR errors and confidence assessment
- **Correction Suggestions**: Intelligent recommendations for transcript improvements

#### API Endpoints:
- `POST /api/agent/transcript-refinement` - Trigger full transcript refinement
- `POST /api/tools/ner` - Named Entity Recognition analysis
- `GET /api/tools/ner` - NER service health check

#### Usage:
```javascript
// Initialize the agent
const agent = new TranscriptRefinementAgent(false); // false = use real OpenRouter

// Analyze a single segment
const analysis = await agent.analyzeSegment(
  "Tallinna Ülikooli rektor Tiit Land.",
  "segment_1",
  0,
  5000,
  "Speaker 1"
);

// Refine entire transcript
const result = await agent.refineTranscript(
  "file_123",
  words,
  speakers,
  transcriptContent
);
```

#### Configuration:
Set your OpenRouter API key in `.env`:
```
OPENROUTER_API_KEY=your_api_key_here
```

The system automatically falls back to mock mode if the API key is not available.

## Development

### Prerequisites
- Node.js 18+
- Bun package manager
- PostgreSQL database

### Setup
1. Clone the repository
2. Install dependencies: `bun install`
3. Set up environment variables (see `.env.example`)
4. Run database migrations: `bun run db:migrate`
5. Start development server: `bun run dev`

### Testing
- Run all tests: `bun test`
- Test transcript refinement: `bun run scripts/test_transcript_refinement.js`
- Test NER integration: `bun run scripts/test_segment_ner_integration.js`

## Architecture

The application uses:
- **SvelteKit** for the frontend and API routes
- **TipTap** for the rich text editor
- **Prisma** for database management
- **OpenRouter** for LLM integration
- **LangChain** for agent orchestration

## License

MIT License - see LICENSE file for details.
