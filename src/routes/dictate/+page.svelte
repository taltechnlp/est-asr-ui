<script lang="ts">
	import { goto } from '$app/navigation';
	import { _ } from 'svelte-i18n';
	import { onMount, onDestroy } from 'svelte';
	import microphone from 'svelte-awesome/icons/microphone';
	import stop from 'svelte-awesome/icons/stop';
	import microphoneSlash from 'svelte-awesome/icons/microphone-slash';
	import Icon from 'svelte-awesome/components/Icon.svelte';
	import { Transcription, Dictate } from '$lib/helpers/dictate.js/dictate';

	const SERVER = 'wss://bark.phon.ioc.ee:8443/dev/duplex-speech-api/ws/speech';
	const SERVER_STATUS = 'wss://bark.phon.ioc.ee:8443/dev/duplex-speech-api/ws/status';

	// Defaults
	//var SERVER = "ws://bark.phon.ioc.ee:82/dev/duplex-speech-api/ws/speech";
	//var SERVER_STATUS = "ws://bark.phon.ioc.ee:82/dev/duplex-speech-api/ws/status";
	var REFERENCE_HANDLER = 'http://bark.phon.ioc.ee:82/dev/duplex-speech-api/dynamic/reference';
	var CONTENT_TYPE =
		'content-type=audio/x-raw,+layout=(string)interleaved,+rate=(int)16000,+format=(string)S16LE,+channels=(int)1';
	// non-interleaved
	const TYPE2 = 'content-type=audio/x-raw';
	// Send blocks 4 x per second as recommended in the server doc.
	var INTERVAL = 250;
	var TAG_END_OF_SENTENCE = 'EOS';

	// Server status codes
	// from https://github.com/alumae/kaldi-gstreamer-server
	const SERVER_STATUS_CODE = {
		0: 'Success', // Usually used when recognition results are sent
		1: 'No speech', // Incoming audio contained a large portion of silence or non-speech
		2: 'Aborted', // Recognition was aborted for some reason
		9: 'No available' // Recognizer processes are currently in use and recognition cannot be performed
	};

	let player;
	let downloadLink;
	let stopButton;
	let startButton;
	let mediaRecorder;
	type RecorderStates = 'recording' | 'stopped' | 'error';
	let recorderState: RecorderStates;
	$: console.log(recorderState);
	const Permissions = ['granted', 'prompt', 'denied', 'unsupported'] as const;
	type Permission = typeof Permissions[number];
	let microphonePermission: Permission = 'unsupported';
	let ws;
	let workerAvaiable = true;
	let numWorkersAvailable: number;
	let log,
		statusBar,
		transcription,
		serverStatusBar = '';

	let tt;
	let dictate;

	let iconHover = false;
	const handleHover = () => (iconHover = true);

	const MESSAGE_CODES = {
		11: 'Stopped recording'
	};

	// Private methods (called from the callbacks)
	function __message(code, data) {
		log = 'msg: ' + code + ': ' + (data || '') + '\n' + log;
		if (code == 2) recorderState = 'stopped';
	}

	function __error(code, data) {
		log = 'ERR: ' + code + ': ' + (data || '') + '\n' + log;
		recorderState = 'error';
	}

	function __status(msg) {
		statusBar = msg;
	}

	function __serverStatus(msg) {
		serverStatusBar = msg;
	}

	function __updateTranscript(text) {
		transcription = text;
	}

	// Public methods (called from the GUI)
	function toggleLog() {
		// $(log).toggle();
	}
	function clearLog() {
		log.innerHTML = '';
	}

	function clearTranscription() {
		tt = new Transcription({});
		transcription = '';
	}

	function startListening() {
		dictate.startListening();
	}

	function stopListening() {
		dictate.stopListening();
	}

	function cancel() {
		dictate.cancel();
	}

	function init() {
		dictate.init();
	}

	function showConfig() {
		var pp = JSON.stringify(dictate.getConfig(), undefined, 2);
		log = pp + '\n' + log;
		// $(log).show();
	}

	function initializeStream() {
		tt = new Transcription({});

		dictate = new Dictate({
			server: 'wss://bark.phon.ioc.ee:8443/dev/duplex-speech-api/ws/speech',
			serverStatus: 'wss://bark.phon.ioc.ee:8443/dev/duplex-speech-api/ws/status',
			onReadyForSpeech: function () {
				__message('READY FOR SPEECH');
				__status('Kuulan ja transkribeerin...');
				recorderState = 'recording';
			},
			onEndOfSpeech: function () {
				__message('END OF SPEECH');
				__status('Transkribeerin...');
			},
			onEndOfSession: function () {
				__message('END OF SESSION');
				__status('');
				recorderState = 'stopped';
			},
			onServerStatus: function (json) {
				console.log('json', json);
				__serverStatus(json.num_workers_available + ':' + json.num_requests_processed);
				numWorkersAvailable = json.num_workers_available;
			},
			onPartialResults: function (hypos) {
				// TODO: demo the case where there are more hypos
				tt.add(hypos[0].transcript, false);
				__updateTranscript(tt.toString());
			},
			onResults: function (hypos) {
				// TODO: demo the case where there are more results
				tt.add(hypos[0].transcript, true);
				__updateTranscript(tt.toString());
			},
			onError: function (code, data) {
				__error(code, data);
				__status('Viga: ' + code);
				dictate.cancel();
			},
			onEvent: function (code, data) {
				__message(code, data);
				console.log('onEvent', code);
				if (code == 11) recorderState = 'stopped';
				else if (code == 3) {
					dictate.startListening();
				}
			}
		});
		dictate.init();
	}

	const checkMicPermission = () => {
		navigator.permissions
			.query({ name: 'microphone' })
			.then(function (result) {
				console.log(result.status);
				if (result.state == 'granted') {
					microphonePermission = 'granted';
				} else if (result.state == 'prompt') {
					microphonePermission = 'prompt';
				} else if (result.state == 'denied') {
					microphonePermission = 'denied';
				}
				result.onchange = function (e) {
					microphonePermission = e.target.state;
				};
			})
			.catch((e) => (microphonePermission = 'unsupported'));
	};
	checkMicPermission();
	$: console.log(microphonePermission);
	const startRecorder = async () => {
		if (selectedRecognizer == 0) recognition.start();
		else if (!dictate) initializeStream();
		else {
			dictate.startListening();
		}
	};
	const stopRecorder = function () {
		if (selectedRecognizer == 0) {
			recognition.stop();
			recorderState = "stopped";
		} else {
			dictate.stopListening();
			recorderState = 'stopped';
		}
	};
	$: if (recorderState === 'stopped') {
		if (dictate && selectedRecognizer == 1) {
			const recorder = dictate.getRecorder();
			console.log(recorder, dictate);
		}
	}
	export const getMedia = async () => {
		const constraints = {
			audio: true,
			video: false
		};
		let stream = null;
		try {
			stream = await navigator.mediaDevices.getUserMedia(constraints);
			/* use the stream */
			console.log('stream created', stream);
		} catch (err) {
			/* handle the error */
			console.log('stream creation error', err);
		}
	};
	let recognition;
	let recordingText = '';
	$: console.log(recordingText);
	const initWebReco = () => {
		// Browser dictation
		console.log('ok');
		try {
			let SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
			recognition = new SpeechRecognition();
			recordingText = `Press the Play button to Start recording.`; // use this in HTML
			//recognition.continuous - If false, the recording will stop after a few seconds of silence.
			// When true, the silence period is longer (about 15 seconds)
			recognition.continuous = true;
			recognition.lang = 'et';
			recognition.interimResults = false;
			recognition.maxAlternatives = 1;
			// onresult called every time the Speech API captures Voice.
			recognition.onresult = function (event) {
				let current = event.resultIndex;
				// Get a transcript of what was said.
				console.log(event.results);
				transcription = event.results[current][0].transcript;
				console.log(transcription);
				console.log('Confidence: ' + event.results[0][0].confidence);
			};

			// Trigger on start
			recognition.onstart = function () {
				// setting the text to inform user about the action
				recorderState = 'recording';
			};
			// Trigger on end
			recognition.onspeechend = function () {
				// setting the text to inform user about the action
				console.log('onspeechend');
				recorderState = 'stopped';
				recognition.stop();
			};
			// Trigger on error
			recognition.onerror = function (event) {
				if (event.error == 'no-speech') {
					// setting the text to inform user about the action
					// recordingText = 'No Voice was detected. Try again.';
				}
				recorderState = 'error';
			};
		} catch (e) {
			console.error(e);
		}
		getMedia().then(() => console.log('initialized'));
	};
	const recognizers = [
		{ id: 0, text: 'browser' },
		{ id: 1, text: 'taltech' }
	];
	const languageChoices = [
		{ id: 0, text: 'estonian', recognizers: [0, 1] },
		{ id: 1, text: 'finnish', recognizers: [0] }
	];
	let selectedLanguage = languageChoices[0];
	let selectedRecognizer = 1;
	let recognizerChoices = [0, 1];
	// Initailize when selected
	$: if (selectedRecognizer == 0) initWebReco();
</script>

<svelte:head>
	<title>Dikteeri</title>
</svelte:head>

<div class="grid w-full justify-center grid-cols-[minmax(320px,_680px)] m-1">
	<h2 class="text-xl mb-6 font-extrabold mt-6">Dikteeri</h2>
	<p class="mb-2">
		Sellel lehel saab kõnetuvastuse abil reaalajaliselt eestikeelset teksti dikteerida. Veebibrauser
		saadab reaalajaliselt kõne TalTechi Kõnetehnoloogia labori serverisse, kus see muudetakse
		tekstiks ning saadetakse veebilehtisejasse tagasi.
	</p>
	<p class="mb-2">
		Safari ning Chrome, Edge, Brave jt Chromiumi baasil ehitatud veebilehitsejatega saab ka kasutada
		veebilehitseja enese kõnetuvastuse võimekust. See küll saavutatakse alati heli kuhugi serverisse
		saatmisega (nt Google'i või Apple'i serverid). Tekstiks.ee ei saa sellisel juhul teada, mis
		selle heliga tehakse.
	</p>
	<p class="mb-2">
		<span class="badge badge-info">Tähelepanu!</span> Rahuldava tuvastuskvaliteedi saamiseks tuleks kasutada
		suu lähedal olevat nn headset-tüüpi mikrofoni. Kindlasti ei tasu dikteerida näiteks sülearvuti sisseehitatud
		mikrofoniga. Parima tulemuse saamiseks tuleks dikteerida selge häälega ja mõõdukas tempos (umbes
		nagu raadiodiktor). Sõnade vahel pause ei pea tegema. Dikteerida saab ka kirjavahemärke (",.!?:;")
		ja reavahetusi (ütle "uus rida").
	</p>
	<div class="flex border-2 rounded-md p-4 mt-6">
		<div class="form-control w-full max-w-xs mr-5">
			<label class="label" for="langSelect">
				<span class="label-text">{$_('files.language')}</span>
			</label>
			<select
				id="langSelect"
				required
				bind:value={selectedLanguage}
				on:change={() => {
					recognizerChoices = selectedLanguage.recognizers;
					if (recognizerChoices.length == 1) selectedRecognizer = 0;
					else selectedRecognizer = 1;
				}}
				class="select select-bordered"
			>
				{#each languageChoices as language}
					<option value={language}>
						{$_(`files.languageChoices.${language.text}`)}
					</option>
				{/each}
			</select>
		</div>
		<div class="form-control w-full max-w-xs">
			<label class="label" for="recoSelect">
				<span class="label-text">{$_('files.recognizer')}</span>
			</label>
			<select
				id="recoSelect"
				required
				bind:value={selectedRecognizer}
				class="select select-bordered"
			>
				{#each recognizerChoices as rId}
					<option value={rId}>
						{$_(`files.recognizer.${recognizers[rId].text}`)}
					</option>
				{/each}
			</select>
		</div>
	</div>
	<div class="flex justify-center mt-10">
		{#if recorderState === 'recording'}
			<button class="pulsate" on:click={stopRecorder} id="stop"
				><Icon style="color:red;" data={microphone} scale={7} /></button
			>
		{:else if microphonePermission === 'denied'}
			<label for="denied-modal" class=""><Icon data={microphoneSlash} scale={7} /></label>
		{:else if microphonePermission === 'granted' || 'unsupported'}
			<button on:click={startRecorder} class="hover:scale-110" id="start"
				><Icon data={microphone} scale={7} /></button
			>
		{:else}
			<label for="permission-modal" class="hover:scale-110"
				><Icon data={microphone} scale={7} /></label
			>
		{/if}
	</div>
	<div class="flex justify-center">
		{#if selectedRecognizer == 1}
			{#if numWorkersAvailable > 0}
				<div class="badge badge-accent mt-2">
					{numWorkersAvailable} vaba ühendust
				</div>
			{:else if numWorkersAvailable == 0 && recorderState !== 'recording'}
				<div class="badge badge-warning mt-2">Ühtegi ühendust pole saadaval!</div>
			{/if}
		{/if}
	</div>
	<textarea
		contenteditable="true"
		bind:textContent={transcription}
		placeholder="Siia ilmub kõnetuvastuse tulemus."
		name="transcription"
		rows="8"
		cols="80"
		class="mt-2"
	/>
	<div class="mt-4 flex justify-left">
		<button on:click={init} class="btn mr-1" title="Request access to the microphone"
			>Laadi tekst alla</button
		>
	</div>
</div>
<input type="checkbox" id="permission-modal" class="modal-toggle" />
<div class="modal modal-bottom sm:modal-middle">
	<div class="modal-box">
		<h3 class="font-bold text-lg">Please provide permission to your microphone</h3>
		<p class="py-4">The browser will prompt to give a permission to access your microphone.</p>
		<div class="modal-action">
			<label for="permission-modal" class="btn btn-outline">Cancel</label>
			<label for="permission-modal" class="btn" on:click={startRecorder}>Ok</label>
		</div>
	</div>
</div>
<input type="checkbox" id="denied-modal" class="modal-toggle" />
<div class="modal modal-bottom sm:modal-middle">
	<div class="modal-box">
		<h3 class="font-bold text-lg">Access to microphone is disabled</h3>
		<p class="py-4">Access to the microphone is disable for this website.</p>
		<div class="modal-action">
			<label for="denied-modal" class="btn btn-outline">Close</label>
		</div>
	</div>
</div>

<style>
	.pulsate {
		border-radius: 10%;
		box-shadow: 0 0 0 0 rgba(0, 0, 0, 1);
		transform: scale(1);
		animation: pulse 2s infinite;
		border-color: red;
	}

	@keyframes pulse {
		0% {
			transform: scale(0.95);
			box-shadow: 0 0 0 0 rgba(0, 0, 0, 0.7);
		}

		70% {
			transform: scale(1);
			box-shadow: 0 0 0 10px rgba(0, 0, 0, 0);
		}

		100% {
			transform: scale(0.95);
			box-shadow: 0 0 0 0 rgba(0, 0, 0, 0);
		}
	}
</style>
