import type WaveSurfer from "wavesurfer.js/src/wavesurfer"; 
import { Editor } from '@tiptap/core';
export {};

declare global {
    interface Window {
      myEditor: Editor | undefined;
      myPlayer: WaveSurfer | undefined;
    }
  } 