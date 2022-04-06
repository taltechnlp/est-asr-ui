<script context="module">
	import Tiptap from '$lib/components/Tiptap.svelte';
	import Player from '$lib/components/Player.svelte';
	import { fileQuery, getFile } from '$lib/queries/file';
	export async function load({ params, fetch, session, stuff }) {
		console.log("params.fileId", params.fileId)
		const file = await getFile(params.fileId);
		return { props: {file} };
	}
</script>

<script lang="ts">
	import Icon from 'svelte-awesome/components/Icon.svelte'
	import minus from 'svelte-awesome/icons/minus-circle'
	import plus from 'svelte-awesome/icons/plus-circle'
	
    export let file
	const combineWords = (acc, word: Word) => {
		return (
			acc + `<span start="${word.start}" end="${word.end}">${word.word_with_punctuation} </span>`
		);
	};

	const mapTurns = (turn: Turn, speakers: Speakers) => {
		return `<speaker data-name="${speakers[turn.speaker].name || turn.speaker}">${turn.words.reduce(
			combineWords,
			''
		)}</speaker>`;
	};
	const toEditorFormat = (transcription: EditorContent) => {
		return transcription.sections.reduce((acc, section) => {
			if (section.type==="speech" && section.turns) {
				const res = acc
					.concat(section.turns.map((turn) => {
						const result = mapTurns(turn, transcription.speakers)
						return result}))
				return res
			} else return acc;
		}, []).join(' ');
	};

	type SectionType = 'non-speech' | 'speech';
	type Speakers = {
		[index: string]: { name?: string };
	};
	type Word = {
		confidence: number;
		start: number;
		end: number;
		punctuation: number;
		word: string;
		word_with_punctuation: string;
		unnormalized_words?: [
			{
				confidence: number,
				end: number,
				word_with_punctuation: string,
				punctuation: string,
				start: number,
				word: string
			}
		]
	};
	type Turn = {
		start: number;
		end: number;
		speaker: string;
		transcript: string;
		unnormalized_transcript: string;
		words?: [Word];
	};
	type EditorContent = {
		speakers: Speakers;
		sections: [
			{
				start: number;
				end: number;
				type: SectionType;
				turns?: [Turn];
			}
		];
	};

	const editorContent: EditorContent = toEditorFormat(JSON.parse(file && file.initialTranscription));
	console.log(editorContent)
</script>

<main class="grid grid-rows-[1fr_auto] content-between">
	<div class="self-stretch h-full mb-96">
		<Tiptap content={editorContent} />
	</div>
    <div class="w-full h-auto fixed bottom-0 left-0 pb-1 bg-white">
        <div class="controls flex justify-between pt-0.5">
            <div class="flex justify-center content-center mt-3">
				<button class="btn btn-square btn-sm control-button ml-5">
					<Icon data={plus} scale="{1}" />        
				</button>
                <button class="btn btn-square btn-sm control-button ml-2">
					<Icon data={minus} scale="{1}" />                    
                </button>
            </div>
            <div class="flex justify-center">
                <button class="btn btn-square control-button ">
                    <svg viewBox="0 0 24 24" class="h-6 w-6 border-0" fill="rgba(0, 0, 0, 0.54)" stroke="currentColor"><path d="M15,6.485V.137L1.285,9.23l-.029.02a3,3,0,0,0,0,4.883L15,23.943V17.515l9,6.428V.057Z"/></svg>
                </button>
                <button class="btn btn-square control-button ml-5">
                    <svg viewBox="0 0 24 24" class="h-6 w-6" fill="rgba(0, 0, 0, 0.54)" stroke="currentColor"><path d="M20.492,7.969,10.954.975A5,5,0,0,0,3,5.005V19a4.994,4.994,0,0,0,7.954,4.03l9.538-6.994a5,5,0,0,0,0-8.062Z"/></svg>
                </button>
                <button class="btn btn-square control-button ml-5">
                    <svg viewBox="0 0 24 24" class="h-6 w-6" fill="rgba(0, 0, 0, 0.54)" stroke="currentColor"><path d="M22.74,9.25,9,.137V6.485L0,.057V23.943l9-6.428v6.428l13.741-9.811a3,3,0,0,0,0-4.882Z"/></svg>                    
                </button>
            </div>
            <div>
				<svg viewBox="0 0 576 512" class="h-6 w-6" fill="rgba(0, 0, 0, 0.54)" stroke="currentColor"><path d="M301.2 34.85c-11.5-5.188-25.02-3.122-34.44 5.253L131.8 160H48c-26.51 0-48 21.49-48 47.1v95.1c0 26.51 21.49 47.1 48 47.1h83.84l134.9 119.9c5.984 5.312 13.58 8.094 21.26 8.094c4.438 0 8.972-.9375 13.17-2.844c11.5-5.156 18.82-16.56 18.82-29.16V64C319.1 51.41 312.7 40 301.2 34.85zM513.9 255.1l47.03-47.03c9.375-9.375 9.375-24.56 0-33.94s-24.56-9.375-33.94 0L480 222.1L432.1 175c-9.375-9.375-24.56-9.375-33.94 0s-9.375 24.56 0 33.94l47.03 47.03l-47.03 47.03c-9.375 9.375-9.375 24.56 0 33.94c9.373 9.373 24.56 9.381 33.94 0L480 289.9l47.03 47.03c9.373 9.373 24.56 9.381 33.94 0c9.375-9.375 9.375-24.56 0-33.94L513.9 255.1z"/></svg>
				</div>
        </div>
        <div id="waveform" class=""></div>
        <div id="wave-timeline" class="w-full h-auto" />
        <Player />
    </div>
</main>

<style>
    .controls {
        border-top: 2px solid rgba(23, 42, 58, 0.1);
    }
    .control-button {
		color: rgba(0, 0, 0, 0.54);
        background-color: white;
        background-image: linear-gradient(rgb(255, 255, 255), rgb(244, 245, 247));
    }
    .control-button:hover {
        background-image: linear-gradient(rgb(250, 251, 251), rgb(234, 236, 238));
    }
</style>
