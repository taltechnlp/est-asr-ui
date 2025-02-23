import { Editor } from '@tiptap/core'; 
import { Session } from "@auth/core/types";
import type Peaks from "peaks.js";

declare global {
  interface Window {
    myEditor: Editor | undefined;
    myPlayer: Peaks | undefined;
  }
  
}
/* interface Sess extends Session {
  user: {
    name?: string | null;
    email?: string | null
    id?: string;
  }
}  
export {
  Sess
}; */

declare module "@auth/core/jwt" {
  /** Returned by the `jwt` callback and `auth`, when using JWT sessions */
  interface JWT {
    id: string
		email: string
		name: string
		picture: string
  }
}