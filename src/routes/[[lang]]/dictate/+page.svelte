<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { browser } from '$app/environment';
	import { MicVAD } from '@ricky0123/vad-web';
	import * as ort from 'onnxruntime-web';

	// Configure ONNX Runtime to use WASM only (disable WebGPU to avoid warnings)
	if (browser) {
		// Disable WebGPU
		ort.env.webgpu = { disabled: true } as any;

		// Configure WASM
		ort.env.wasm.numThreads = 1;
		ort.env.wasm.simd = true;
		ort.env.wasm.proxy = false;
	}

	// Audio processing constants
	const SAMPLE_RATE = 16000;
	const WS_URL = 'ws://127.0.0.1:8081/ws';

	// WebSocket connection
	let ws: WebSocket | null = null;
	let sessionId: string | null = null;

	// VAD instance
	let vad: MicVAD | null = null;
	let isVadActive = $state(false);
	let isSpeaking = $state(false);

	// Pre-speech circular buffer
	const PRE_SPEECH_BUFFER_MS = 300; // 300ms pre-speech buffer
	const FRAME_SIZE = 1536; // VAD frame size at 16kHz
	const FRAMES_TO_BUFFER = Math.ceil((PRE_SPEECH_BUFFER_MS / 1000) * SAMPLE_RATE / FRAME_SIZE);
	let audioBuffer: Float32Array[] = [];

	// UI State
	let isConnected = $state(false);
	let isRecording = $state(false);
	let isWasmLoading = $state(false);
	let isWasmReady = $state(false);
	let initializationStatus = $state('');
	let connectionError = $state('');
	let microphoneError = $state('');
	let vadError = $state('');

	// Transcript state
	let transcript = $state('');
	let partialTranscript = $state('');
	let availableLanguages = $state<string[]>(['et', 'en', 'ru', 'uk']);
	let selectedLanguage = $state('et');
	let availableModels = $state<string[]>([]);

	// Past recordings
	interface Recording {
		id: string;
		text: string;
		timestamp: Date;
	}
	let pastRecordings = $state<Recording[]>([]);

	// Get flag emoji for language code
	function getFlagEmoji(langCode: string): string {
		const flags: Record<string, string> = {
			et: '🇪🇪',
			en: '🇬🇧',
			fi: '🇫🇮',
			ru: '🇷🇺',
			uk: '🇺🇦'
		};
		return flags[langCode.toLowerCase()] || '🌐';
	}

	// Format timestamp for display
	function formatTimestamp(date: Date): string {
		return date.toLocaleString(undefined, {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
	}

	// Copy text to clipboard
	async function copyToClipboard(text: string) {
		try {
			await navigator.clipboard.writeText(text);
		} catch (error) {
			console.error('Failed to copy text:', error);
		}
	}

	// Delete a past recording
	function deleteRecording(id: string) {
		pastRecordings = pastRecordings.filter((r) => r.id !== id);
	}

	// Initialize system: pre-load WASM and connect WebSocket
	async function initializeSystem() {
		try {
			// Step 1: Connect to WebSocket
			initializationStatus = $_('dictate.connectingToServer');
			await connectWebSocket();
			await new Promise((resolve) => setTimeout(resolve, 500));

			if (!isConnected) {
				vadError = 'Failed to connect to server';
				return;
			}

			// Step 2: Pre-load VAD WASM models
			initializationStatus = $_('dictate.loadingVadModel');
			isWasmLoading = true;

			vad = await MicVAD.new({
				// Speech detection thresholds
				positiveSpeechThreshold: 0.6,
				negativeSpeechThreshold: 0.4,
				preSpeechPadFrames: 10,
				redemptionFrames: 8,
				minSpeechFrames: 3,

				// Callbacks
				onFrameProcessed: (probabilities, frame: Float32Array) => {
					// Always buffer frames for pre-speech
					audioBuffer.push(new Float32Array(frame));
					if (audioBuffer.length > FRAMES_TO_BUFFER) {
						audioBuffer.shift();
					}

					// Stream frame in real-time if speech is active
					if (isSpeaking) {
						sendAudio(frame);
					}
				},

				onSpeechStart: () => {
					console.log('🎤 Speech started - sending pre-speech buffer');
					isSpeaking = true;

					// Send pre-speech buffer first
					for (const bufferedFrame of audioBuffer) {
						sendAudio(bufferedFrame);
					}
					audioBuffer = [];
				},

				onSpeechEnd: (audio: Float32Array) => {
					console.log('🔇 Speech ended');
					isSpeaking = false;

					// Signal to server that utterance is complete
					sendMessage({
						type: 'utterance_end'
					});
				},

				onVADMisfire: () => {
					console.log('⚠️ VAD misfire detected');
					isSpeaking = false;
				},

				// Local asset paths
				workletURL: '/vad/vad.worklet.bundle.min.js',
				modelURL: '/vad/silero_vad_legacy.onnx',
				baseAssetPath: '/vad/',
				onnxWASMBasePath: '/onnx/',

				// Don't start yet - we'll start when user clicks record
				startOnLoad: false
			});

			isWasmLoading = false;
			isWasmReady = true;
			initializationStatus = $_('dictate.readyToRecord');

			console.log('System initialized successfully');
		} catch (error: any) {
			console.error('Failed to initialize system:', error);
			isWasmLoading = false;
			isWasmReady = false;

			if (error.message?.includes('vad') || error.message?.includes('onnx')) {
				vadError = 'Failed to load voice detection model';
			} else {
				vadError = error.message || $_('dictate.initializationFailed');
			}
			initializationStatus = $_('dictate.initializationFailed');
		}
	}

	// Connect to WebSocket server
	async function connectWebSocket() {
		try {
			connectionError = '';
			ws = new WebSocket(WS_URL);

			ws.onopen = () => {
				console.log('WebSocket connected');
				isConnected = true;
			};

			ws.onmessage = (event) => {
				try {
					const message = JSON.parse(event.data);
					handleServerMessage(message);
				} catch (e) {
					console.error('Failed to parse server message:', e);
				}
			};

			ws.onclose = () => {
				console.log('WebSocket disconnected');
				isConnected = false;
				sessionId = null;
			};

			ws.onerror = (error) => {
				console.error('WebSocket error:', error);
				connectionError = $_('dictate.noConnections');
				isConnected = false;
			};
		} catch (error) {
			console.error('Failed to connect:', error);
			connectionError = $_('dictate.noConnections');
		}
	}

	// Disconnect WebSocket
	function disconnectWebSocket() {
		if (ws) {
			ws.close();
			ws = null;
		}
		isConnected = false;
		sessionId = null;
	}

	// Handle server messages
	function handleServerMessage(message: any) {
		console.log('Received message:', message);

		switch (message.type) {
			case 'ready':
				sessionId = message.session_id;
				if (message.available_languages) {
					availableLanguages = message.available_languages;
				}
				if (message.available_models) {
					availableModels = message.available_models;
				}
				console.log('Session ready:', sessionId);
				break;

			case 'transcript':
				console.log('Received transcript:', message.text, 'is_final:', message.is_final);
				if (message.is_final) {
					// Add to final transcript
					if (message.text.trim()) {
						console.log('Adding to final transcript:', message.text.trim());
						transcript += (transcript ? ' ' : '') + message.text.trim();
					}
					partialTranscript = '';
				} else {
					// Show as partial transcript
					console.log('Setting partial transcript:', message.text);
					partialTranscript = message.text;
				}
				break;

			case 'error':
				console.error('Server error:', message.message);
				connectionError = message.message;
				break;

			case 'session_ended':
				console.log('Session ended:', message.session_id);
				sessionId = null;
				break;
		}
	}

	// Send WebSocket message
	function sendMessage(message: any) {
		if (ws && ws.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify(message));
		}
	}

	// Convert Float32Array to Int16Array
	function float32ToInt16(float32Array: Float32Array): Int16Array {
		const int16Array = new Int16Array(float32Array.length);
		for (let i = 0; i < float32Array.length; i++) {
			const s = Math.max(-1, Math.min(1, float32Array[i]));
			int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
		}
		return int16Array;
	}

	// Send audio to server
	function sendAudio(audioData: Float32Array) {
		if (!ws || ws.readyState !== WebSocket.OPEN) {
			return;
		}

		// Convert Float32 to Int16
		const int16Data = float32ToInt16(audioData);
		const bytes = new Uint8Array(int16Data.buffer);

		// Convert to base64 without using apply (avoids stack overflow)
		let binary = '';
		const len = bytes.byteLength;
		for (let i = 0; i < len; i++) {
			binary += String.fromCharCode(bytes[i]);
		}
		const base64 = btoa(binary);

		sendMessage({
			type: 'audio',
			data: base64
		});
	}

	// Start recording with VAD (VAD already initialized, just start microphone)
	async function startRecording() {
		try {
			microphoneError = '';
			vadError = '';

			// Ensure system is ready
			if (!isWasmReady || !vad) {
				vadError = 'System not initialized. Please wait...';
				return;
			}

			if (!isConnected || !ws) {
				connectionError = $_('dictate.noConnections');
				return;
			}

			// Send start message to establish session
			sendMessage({
				type: 'start',
				sample_rate: SAMPLE_RATE,
				format: 'pcm',
				language: selectedLanguage
			});

			// Start the already-initialized VAD (requests microphone access)
			await vad.start();
			isVadActive = true;
			isRecording = true;

			console.log('Recording started successfully');
		} catch (error: any) {
			console.error('Failed to start recording:', error);
			if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
				microphoneError = $_('dictate.providePermission');
			} else {
				microphoneError = error.message || 'Failed to start recording';
			}
			stopRecording();
		}
	}

	// Stop recording
	async function stopRecording() {
		isRecording = false;
		isVadActive = false;
		isSpeaking = false;

		// Pause VAD (don't destroy - keep it loaded for next time)
		if (vad) {
			try {
				vad.pause();
			} catch (error) {
				console.error('Error pausing VAD:', error);
			}
		}

		// Send stop message
		if (ws && ws.readyState === WebSocket.OPEN && sessionId) {
			sendMessage({ type: 'stop' });
		}

		// Wait a bit for final results, then save to past recordings
		await new Promise(resolve => setTimeout(resolve, 1000));

		// Combine final and partial transcripts
		const finalText = (transcript + ' ' + partialTranscript).trim();

		if (finalText) {
			console.log('Saving recording to past recordings:', finalText);
			const newRecording: Recording = {
				id: Date.now().toString(),
				text: finalText,
				timestamp: new Date()
			};
			pastRecordings = [newRecording, ...pastRecordings];
			console.log('Past recordings count:', pastRecordings.length);
			transcript = '';
			partialTranscript = '';
		}
	}

	// Clear transcript
	function clearTranscript() {
		transcript = '';
		partialTranscript = '';
	}

	// Download transcript
	function downloadTranscript() {
		const text = transcript || $_('dictate.resultsPlaceholder');
		const blob = new Blob([text], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `transcript-${new Date().toISOString()}.txt`;
		a.click();
		URL.revokeObjectURL(url);
	}

	// Initialize on component mount
	onMount(() => {
		initializeSystem();
	});

	// Cleanup on component destroy
	onDestroy(() => {
		stopRecording();

		// Destroy VAD on unmount
		if (vad) {
			try {
				vad.destroy();
				vad = null;
			} catch (error) {
				console.error('Error destroying VAD on unmount:', error);
			}
		}

		disconnectWebSocket();
	});
</script>

<svelte:head>
	<title>{$_('dictate.title')} | tekstiks.ee</title>
</svelte:head>

<main class="container mx-auto px-4 py-8 max-w-4xl">
	<!-- Header -->
	<div class="mb-8">
		<h1 class="text-4xl font-bold mb-4">{$_('dictate.title')}</h1>
		<div class="prose max-w-none">
			<p class="mb-2">{$_('dictate.intro1')}</p>
			<p class="mb-2">{$_('dictate.intro2')}</p>
			<p class="mb-4">{$_('dictate.intro3')}</p>
		</div>
	</div>

	<!-- Error Messages -->
	{#if connectionError}
		<div class="alert alert-error mb-6">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="stroke-current shrink-0 h-6 w-6"
				fill="none"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
			<span>{connectionError}</span>
		</div>
	{/if}

	{#if microphoneError}
		<div class="alert alert-warning mb-6">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="stroke-current shrink-0 h-6 w-6"
				fill="none"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
				/>
			</svg>
			<span>{microphoneError}</span>
		</div>
	{/if}

	{#if vadError}
		<div class="alert alert-error mb-6">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="stroke-current shrink-0 h-6 w-6"
				fill="none"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
			<span>{vadError}</span>
		</div>
	{/if}

	<!-- Recording Controls -->
	<div class="card bg-base-200 shadow-xl mb-6 relative">
		<div class="card-body">
			<!-- Status Badge - Top Right -->
			<div class="absolute top-4 right-4">
				{#if isWasmLoading || !isWasmReady}
					<div class="badge badge-info gap-2 p-3">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-4 w-4 animate-spin"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
							/>
						</svg>
						<span>{initializationStatus}</span>
					</div>
				{:else if isWasmReady && isConnected}
					<div class="badge badge-success gap-2 p-3">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-4 w-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						<span>{initializationStatus}</span>
					</div>
				{/if}
			</div>

			<h2 class="card-title mb-6">{$_('dictate.recognizers')}</h2>

			<div class="flex flex-col items-center justify-center gap-6">
				<!-- Language Selection -->
				<div class="form-control w-full max-w-xs">
					<label class="label justify-center">
						<span class="label-text font-medium">{$_('files.language')}</span>
					</label>
					<select
						class="select select-bordered select-lg w-full text-center text-lg"
						bind:value={selectedLanguage}
						disabled={isRecording}
					>
						{#each availableLanguages as lang}
							<option value={lang}>{getFlagEmoji(lang)} {lang.toUpperCase()}</option>
						{/each}
					</select>
				</div>

				<!-- Recording Button -->
				{#if !isRecording}
					<div class="flex flex-col items-center gap-3">
						<button
							class="btn btn-circle btn-primary w-24 h-24 hover:scale-105 transition-transform shadow-lg"
							onclick={startRecording}
							disabled={!isWasmReady || !isConnected}
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-12 w-12"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
								/>
							</svg>
						</button>
						<span class="text-base font-semibold">{$_('dictate.startRecording')}</span>
					</div>
				{:else}
					<div class="flex flex-col items-center gap-3">
						<button class="btn btn-circle btn-error w-24 h-24 animate-pulse shadow-lg" onclick={stopRecording}>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-12 w-12"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
								/>
							</svg>
						</button>
						<span class="text-base font-semibold">{$_('dictate.stopRecording')}</span>
					</div>
				{/if}
			</div>

			<!-- VAD Status Indicator -->
			{#if isRecording}
				<div class="alert mt-4" class:alert-info={!isSpeaking} class:alert-success={isSpeaking}>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="stroke-current shrink-0 h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					{#if isSpeaking}
						<span>{$_('dictate.speakingDetected')}</span>
					{:else}
						<span>{$_('dictate.listeningForSpeech')}</span>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<!-- Transcript Display -->
	<div class="card bg-base-200 shadow-xl">
		<div class="card-body">
			<div class="flex justify-between items-center mb-4">
				<h2 class="card-title">{$_('dictate.transcript')}</h2>
				<div class="flex gap-2">
					<!-- Copy Button -->
					<button
						class="btn btn-sm btn-ghost btn-circle"
						onclick={() => copyToClipboard(transcript)}
						disabled={!transcript}
						title="Copy to clipboard"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-4 w-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
							/>
						</svg>
					</button>
					<!-- Delete Button -->
					<button
						class="btn btn-sm btn-ghost btn-circle"
						onclick={clearTranscript}
						disabled={!transcript && !partialTranscript}
						title="Clear transcript"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-4 w-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
							/>
						</svg>
					</button>
					<!-- Download Button -->
					<button
						class="btn btn-sm btn-primary btn-circle"
						onclick={downloadTranscript}
						disabled={!transcript}
						title="Download transcript"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-4 w-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
							/>
						</svg>
					</button>
				</div>
			</div>

			<div
				class="bg-base-100 rounded-lg p-6 min-h-[300px] font-mono text-sm whitespace-pre-wrap"
			>
				{#if transcript || partialTranscript}
					<div class="space-y-2">
						{#if transcript}
							<p class="text-base-content">{transcript}</p>
						{/if}
						{#if partialTranscript}
							<p class="text-base-content/50 italic">{partialTranscript}</p>
						{/if}
					</div>
				{:else}
					<p class="text-base-content/50 italic">{$_('dictate.resultsPlaceholder')}</p>
				{/if}
			</div>
		</div>
	</div>

	<!-- Past Recordings -->
	{#if pastRecordings.length > 0}
		<div class="mt-6 space-y-4">
			<h2 class="text-2xl font-bold">{$_('dictate.pastRecordings')}</h2>
			{#each pastRecordings as recording (recording.id)}
				<div class="card bg-base-200 shadow-xl">
					<div class="card-body">
						<div class="flex justify-between items-start mb-2">
							<div class="text-sm text-base-content/60">
								{formatTimestamp(recording.timestamp)}
							</div>
							<div class="flex gap-2">
								<!-- Copy Button -->
								<button
									class="btn btn-sm btn-ghost btn-circle"
									onclick={() => copyToClipboard(recording.text)}
									title="Copy to clipboard"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-4 w-4"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
										/>
									</svg>
								</button>
								<!-- Delete Button -->
								<button
									class="btn btn-sm btn-ghost btn-circle"
									onclick={() => deleteRecording(recording.id)}
									title="Delete recording"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-4 w-4"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
										/>
									</svg>
								</button>
							</div>
						</div>
						<div
							class="bg-base-100 rounded-lg p-4 font-mono text-sm whitespace-pre-wrap"
						>
							{recording.text}
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</main>
