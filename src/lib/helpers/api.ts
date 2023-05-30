import { unlink } from "fs/promises";
import { prisma } from "$lib/db/client";
import { createWriteStream } from "fs";
import type {
  EditorContent,
  EstResult,
  FinAsrFinished,
  FinAsrResult,
  SectionType,
  TranscriberResult,
} from "./api.d";
import { EST_ASR_URL, FIN_ASR_RESULTS_URL} from "$env/static/private";
import { spawn } from "child_process";
import { promises as fs } from "fs";

let finToEstFormat: (sucRes: FinAsrFinished) => EditorContent = function (
  sucRes: FinAsrFinished,
) {
  const result = {
    speakers: {
      S1: {
        name: "S1",
      },
    },
    sections: [{
      start: 0,
      end: 0,
      type: "non-speech" as SectionType,
    }],
  };
  if (
    sucRes.result && sucRes.result.sections && sucRes.result.sections.length > 0
  ) {
    result.sections = sucRes.result.sections.map(
      (seg) => {
        return {
          start: seg.start,
          end: seg.end,
          type: "speech" as SectionType,
          turns: [{
            start: seg.start,
            end: seg.end,
            speaker: "S1",
            transcript: seg.transcript,
            unnormalized_transcript: seg.transcript,
            words: seg.words.map((w) => {
              return {
                confidence: 1,
                start: w.start + seg.start,
                end: w.end + seg.start,
                punctuation: "",
                word: w.word,
                word_with_punctuation: w.word,
              };
            }),
          }],
        };
      },
    );
  }

  return result;
};
export const generatePeaks = async (fileId) => {
  const file = await prisma.file.findUnique({
    where: {
      id: fileId,
    },
  });
  let processFailed = false;
  const wavPath = file.path + ".wav";
  let peaksPath = file.path + ".json";
  // ffmpeg - i!{ audio_file } -f sox - | sox - t sox - -c 1 - b 16 - t wav audio.wav rate - v 16k
  const toWav = new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", ["-i", file.path, wavPath]);
    ffmpeg.on("exit", function (code) {
      console.log("ffmpeg finished with " + code);
      if (code === 1 || code == 2) {
        processFailed = true;
      }
      resolve(true);
    });
  });
  await toWav.catch((e) => processFailed = true);
  if (processFailed) {
    return false;
  }
  const peaksDone = new Promise((resolve, reject) => {
    const generatePeaks = spawn("audiowaveform", [
      "-i",
      wavPath,
      "-o",
      peaksPath,
      "--pixels-per-second",
      "1",
      "--bits",
      "8",
    ]);
    generatePeaks.on("exit", function (code) {
      console.log("generate peaks exited with code " + code);
      if (code === 1 || code == 2) {
        processFailed = true;
      }
      resolve(true);
    });
  });
  await peaksDone.catch((e) => processFailed = true);
  await fs.unlink(wavPath);
  if (processFailed) {
    return false;
  }
  const normalizeDone = new Promise((resolve, reject) => {
    const normalize = spawn("python", [
      "./scripts/normalize_peaks.py",
      peaksPath,
    ]);
    normalize.on("exit", function (code) {
      console.log("normalize exited with code " + code);
      resolve(true);
    });
  });
  await normalizeDone.catch((e) => console.log(e));
  return true;
};

export const checkCompletion = async (
  fileId,
  externalId,
  path,
  language,
  uploadDir,
) => {
  if (language === "est") {
    try {
      const result = await fetch(
        "http://bark.phon.ioc.ee/transcribe/v1/result?id=" + externalId
      ).catch(e => {
        console.log("Error fetching", "http://bark.phon.ioc.ee/transcribe/v1/result?id=" + externalId, e);
      })
      if (!result) return {done: false};
      const body: TranscriberResult = await result.json();
      if (!body.done) {
        return { done: false };
      } else if (body.error) {
        console.log(body)
        await prisma.file.update({
          data: { state: "PROCESSING_ERROR" },
          where: {
            id: fileId,
          },
        });
        console.log(
          `Failed to transcribe ${fileId}. Failed with code`,
          body.error.code,
          body.error.message,
        );
        await unlink(path);
        return { done: true };
      } else if (body) {
        const path = `${uploadDir}/${fileId}.json`;
        const text = JSON.stringify(body.result);
        const writeStream = createWriteStream(path);
        writeStream.on("finish", async function () {
          await prisma.file.update({
            data: {
              initialTranscriptionPath: path,
              state: "READY",
            },
            where: {
              id: fileId,
            },
          });
        });
        writeStream.write(text);
        writeStream.end();
        // Pre-generate waveform peaks
        await generatePeaks(fileId);
        return { done: true };
      }
      return { done: false };
    }
    catch (e) {

    }
  } else if (language === "est" && false) {
    const progressRequest = await fetch(
      `${EST_ASR_URL}/progress/` + externalId,
    ).catch(e => {
      console.log("Transcription progress fetch error", e);
    });
    if (!progressRequest) return {done: false}
    // Request successful
    if (progressRequest.status === 200) {
      const progress = await progressRequest.json();
	  // Transcription is in progress
      if (!progress.done) {
        return {
          done: false,
		  fileId,
          progressPrc: progress.progressPercentage,
          status: (progress.jobStatus === "queued" ? "UPLOADED" : "PROCESSING"),
          totalJobsQueued: progress.totalJobsQueued,
          totalJobsStarted: progress.totalJobsStarted,
        };
      } // Transcription finished and succesfully
      else if (progress.done && progress.success) {
        const resultRequest = await fetch(
          `${EST_ASR_URL}/result/` + externalId,
        ).catch(e => console.log("Progress request failed", `${EST_ASR_URL}/progress/` + externalId))
        if (resultRequest && resultRequest.status === 200) {
          const result = await resultRequest.json();
          const path = `${uploadDir}/${fileId}.json`;
          const text = JSON.stringify(result.result);
          const writeStream = createWriteStream(path);
          writeStream.on("finish", async function () {
            await prisma.file.update({
              data: {
                initialTranscriptionPath: path,
                state: "READY",
              },
              where: {
                id: fileId,
              },
            });
          });
          writeStream.write(text);
          writeStream.end();
          // Pre-generate waveform peaks
          await generatePeaks(fileId);
          return { done: true };
        } else {
          // Log failure but keep trying the next time
          console.log(
            "Failed to get a finished result. externalId:",
            externalId,
          );
          return {done: false};
        }
      } else if ((progress.done && !progress.success)) {
        await prisma.file.update({
          data: { state: "PROCESSING_ERROR" },
          where: {
            id: fileId,
          },
        });
        console.log(
          `Failed to transcribe ${fileId}. Failed with code`,
          progress.errorCode,
          progress.errorMessage,
        );
        await unlink(path);
        return { done: true };
      }
    } else if (
      progressRequest.status === 400 || progressRequest.status === 404
    ) {
      const progress = await progressRequest.json();
      await prisma.file.update({
        data: { state: "PROCESSING_ERROR" },
        where: {
          id: fileId,
        },
      });
      console.log(
        `Failed to transcribe ${fileId}. Failed with code`,
        progress.errorCode,
        progress.errorMessage,
      );
      await unlink(path);
      return { done: true };
    } // Network error, service down etc.
    else return { done: false };
  } else {
    const result = await fetch(FIN_ASR_RESULTS_URL, {
      method: "POST",
      body: externalId,
    }).catch(e => console.error("Post failed to", FIN_ASR_RESULTS_URL, externalId))
    const body: FinAsrResult = await result.json();
    if (!body) return { done: false };
    if (!body.done) {
      return { done: false };
    } // Error case
    else if (body.code) {
      await prisma.file.update({
        data: { state: "PROCESSING_ERROR" },
        where: {
          id: fileId,
        },
      });
      console.log(
        `Failed to transcribe ${fileId}. Failed with code ${body.code,
          body.message}`,
      );
      await unlink(path);
      return { done: true };
    } else if (body) {
      const formatted = finToEstFormat(body);
      const path = `${uploadDir}/${fileId}.json`;
      const text = JSON.stringify(formatted);
      const writeStream = createWriteStream(path);
      writeStream.on("finish", async function () {
        await prisma.file.update({
          data: {
            initialTranscriptionPath: path,
            state: "READY",
          },
          where: {
            id: fileId,
          },
        });
      });
      writeStream.write(text);
      writeStream.end();
      // Pre-generate waveform peaks
      await generatePeaks(fileId);
      return { done: true };
    } 
  }
};

export const getFiles = async (id) => {
  const user = await prisma.user.findUnique({
    where: {
      id: id
    },
    include: {
      files: {
        orderBy: {
          uploadedAt: "desc",
        },
        select: {
          id: true,
          state: true,
          text: true,
          filename: true,
          duration: true,
          mimetype: true,
          uploadedAt: true,
          textTitle: true,
          initialTranscription: true,
          externalId: true,
          path: true,
          language: true,
        },
      },
    },
  });
  if (user) return user.files;
  else return [];
};
