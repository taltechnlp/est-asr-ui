import { Editor } from '@tiptap/core';
import { Session } from '@auth/core/types';
import type Peaks from 'peaks.js';

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

declare module '@auth/core/jwt' {
	/** Returned by the `jwt` callback and `auth`, when using JWT sessions */
	interface JWT {
		id: string;
		email: string;
		name: string;
		picture: string;
	}
}

// Base node types
type TextNode = {
	type: 'text';
	text: string;
};

// WordNode (new format - AI editor)
type WordNodeNew = {
	type: 'wordNode';
	attrs: {
		wordIndex: number;
	};
	content: TextNode[];
};

// Legacy word mark format (non-AI editor)
type LegacyWordMarkedText = {
	type: 'text';
	marks: {
		type: string;
		attrs: {
			start: number;
			end: number;
			id?: string;
			lang?: string;
			spellcheck?: string;
		};
	}[];
	text: string;
};

// Content can be either new WordNode or legacy marked text or plain text
type ContentNode = WordNodeNew | LegacyWordMarkedText | TextNode;

export type TipTapEditorContent = {
	type: string;
	content: {
		type: string;
		attrs?: {
			'data-name'?: string;
			id?: string;
			topic?: string | null;
			alternatives?: string | Array<{ rank: number; text: string; avg_logprob: number }>;
		};
		content?: ContentNode[];
	}[];
};
