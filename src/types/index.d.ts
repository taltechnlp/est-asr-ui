import type WaveSurfer from "wavesurfer.js/src/wavesurfer"; 
import { Editor } from '@tiptap/core'; 
import { Session } from "@auth/core/types";

declare global {
  interface Window {
    myEditor: Editor | undefined;
    myPlayer: WaveSurfer | undefined;
  }
  
}
interface Sess extends Session {
  user: {
    name?: string | null;
    email?: string | null
    id?: string;
  }
}  
export {
  Sess
};