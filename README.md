# ASR UI

This project is a fullstack web application that powers the publically available Estonian speech transcription service [https://tekstiks.ee](https://tekstiks.ee). It is built using the SvelteKit web framework and written mainly in TypeScript. The application provides an interactive user interface for editing speech transcriptions.

The server-side part relies on Prisma ORM to interact with a database. The database is used to store basic user data and metadata about the transcribed files. The audio files and transcription are presumed to be stored on a disk. The currently used database is PostgreSQL but it is possible to switch to MySQL or MongoDB which are also supported by Prisma although minor schema changes might then be required.

## Speech Recognition

For speech recognition the [https://tekstiks.ee](https://tekstiks.ee) service makes API calls to another [web server](https://github.com/taltechnlp/est-asr-backend) that executes the [transcription pipeline](https://github.com/taltechnlp/est-asr-pipeline) and return results afterwards.

## Installation

Npm packages can be downloaded using the command `npm install`. It will install all the dependencies defined in the file `package.json`.

In order to configure the system, a `.env` file must be created, an example is provided. AMong other parameters it contains a database connection string.

The database should be installed locally or via a Docker container. A docker-compose file is provided and should then be put into daemon mode with the command:
`docker-compose up -d`

After that a database should be created and an initial user. Then finally, the `prisma/migrations` folder contains SQL scripts that must be executed in order to generate the necessary DB schema.

Prisma is able to generate an API to interact with the database. After the initial schema creation and after any change to the schema, a new API should be generated. It is recommended to install Prisma locally via npm and execute using the following command then:

`npx prisma generate`

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
