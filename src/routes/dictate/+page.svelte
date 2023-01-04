<script lang="ts">
	import { goto } from '$app/navigation';
	import { _ } from 'svelte-i18n';
	import { onMount, onDestroy } from 'svelte';
	import microphone from 'svelte-awesome/icons/microphone';
	import microphoneSlash from 'svelte-awesome/icons/microphone-slash';
	import Icon from 'svelte-awesome/components/Icon.svelte';
	import { message } from './testMessage';
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
	type RecorderStates = "recording" | "stopped" | "error";
	let recorderState: RecorderStates;
	const Permissions = ["granted", "prompt", "denied", "unsupported"] as const;
	type Permission = typeof Permissions[number];
	let microphonePermission: Permission = 'unsupported';
	let ws;
	let workerAvaiable = true;
	let log,
		statusBar,
		transcription, serverStatusBar = '';
	
	let tt;
	let dictate;

	const MESSAGE_CODES = {
		11: "Stopped recording"
	}

	// Private methods (called from the callbacks)
	function __message(code, data) {
		log = 'msg: ' + code + ': ' + (data || '') + '\n' + log;
		if (code == 2) recorderState = "stopped";
	}

	function __error(code, data) {
		log = 'ERR: ' + code + ': ' + (data || '') + '\n' + log;
		recorderState = "error"
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
				recorderState = "recording";
			},
			onEndOfSpeech: function () {
				__message('END OF SPEECH');
				__status('Transkribeerin...');
			},
			onEndOfSession: function () {
				__message('END OF SESSION');
				__status('');
			},
			onServerStatus: function (json) {
				__serverStatus(json.num_workers_available + ':' + json.num_requests_processed);
				if (json.num_workers_available == 0) {
					workerAvaiable = false;
				} else {
					workerAvaiable = true;
				}
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
	}
	checkMicPermission()
	$: console.log(microphonePermission);
	const startRecorder = async () => { 
		if (!dictate) initializeStream();
	};
	const stopRecorder = () => {
		dictate.stopListening();
		recorderState = "stopped";
	};
	const pauseRecorder = () => {
		mediaRecorder.pause();
		recorderState = mediaRecorder.state;
		console.log(recorderState);
	};
	const resumeRecorder = () => {
		mediaRecorder.resume();
		recorderState = mediaRecorder.state;
		console.log(recorderState);
	};

	onMount(async () => {
		
	});
</script>

<svelte:head>
	<title>Dikteeri</title>
</svelte:head>

<div class="grid w-full justify-center grid-cols-[minmax(320px,_640px)] m-1">
	<h2 class="text-xl mb-10 font-extrabold mt-6">Dikteeri</h2>
	<div class="controls">
		<button
			id="buttonStart"
			on:click={startListening}
			title="Starts listening for speech, i.e. starts recording and transcribing.">Start</button
		>
		<button
			id="buttonStop"
			on:click={stopListening}
			title="Stops listening for speech. Speech captured so far will be recognized as if the user had stopped speaking at this point. Note that in the default case, this does not need to be called, as the speech endpointer will automatically stop the recognizer listening when it determines speech has completed."
			>Stopp</button
		>
		<button id="buttonCancel" on:click={cancel} title="Cancels the speech recognition."
			>Katkesta</button
		>
	</div>
	<a bind:this={downloadLink} id="download">Download</a>
	<div class="mt-10">
		{#if recorderState === 'recording'}
			<button on:click={stopRecorder} class="btn btn-outline pulsate" id="stop"
				><Icon style="color:red;" data={microphone} scale={1} />recording</button
			>
		{:else if microphonePermission === 'denied'}
			<label for="denied-modal" class="btn btn-outline"
				><Icon data={microphoneSlash} scale={1} />denied</label
			>
		{:else if microphonePermission === 'granted' || 'unsupported'}
			<button on:click={startRecorder} class="btn btn-outline" id="start"
				><Icon data={microphone} scale={1} />granted</button
			>
		{:else}
			<label for="permission-modal" class="btn btn-outline"
				><Icon data={microphone} scale={1} />bla</label
			>
		{/if}
	</div>
	<div class="controls">
		<button on:click={init} title="Request access to the microphone">Init</button>

		<button on:click={showConfig} title="Show the configuration of the Dictate object">Config</button
		>

		<button on:click={clearLog} title="Clear the log">Clear log</button>
	</div>

	<hr />
	<textarea
		contenteditable="true"
		bind:textContent={transcription}
		name="transcription"
		rows="8"
		cols="80"
	/>
	<hr />
	<pre contenteditable="true" bind:textContent={log} />
	<div contenteditable="true" bind:textContent={statusBar} />



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
