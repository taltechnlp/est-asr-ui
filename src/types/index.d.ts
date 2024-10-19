import { Editor } from '@tiptap/core'; 
import { Session } from "@auth/core/types";
import type Peaks from "peaks.js";

declare global {
  interface Window {
    myEditor: Editor | undefined;
    myPlayer: Peaks | undefined;
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