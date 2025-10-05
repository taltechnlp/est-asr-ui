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

### Python Environment for Advanced Features

The application includes advanced analysis tools for transcript quality assessment and phonetic analysis. These tools require Python dependencies that can be set up in two ways:

**Option 1: Docker Environment (Recommended)**
```bash
# Set up Python tools with all dependencies in Docker
npm run python:setup

# Check status
npm run python:status

# View logs
npm run python:logs
```

This creates a Docker container with PyTorch, TorchMetrics, librosa, and other dependencies for enhanced audio analysis capabilities.

**Option 2: System Python (Fallback)**
The tools will automatically fall back to basic functionality using system Python if Docker is not available. Enhanced features require manual installation:
```bash
pip install torch torchaudio torchmetrics librosa numpy
```

**Available Python Management Commands:**
- `npm run python:setup` - Build and start Python container
- `npm run python:up` - Start Python container
- `npm run python:down` - Stop Python container
- `npm run python:shell` - Access container shell for debugging
- `npm run python:status` - Check container status

The system automatically detects and uses the best available Python environment (Docker with enhanced features, or system Python with fallback methods).

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
