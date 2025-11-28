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
		// Let ONNX auto-detect SIMD support (prevents SIGILL crashes on unsupported CPUs)
		ort.env.wasm.proxy = false;
	}

	// Audio processing constants
	const SAMPLE_RATE = 16000;
	const WS_URL = import.meta.env.VITE_LIVE_DICTATION_WS_URL || 'ws://127.0.0.1:8081/ws';
	const DEBUG_VAD = false; // Set to true to enable verbose VAD logging

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
	let frameCount = 0; // Track total frames received for debugging

	// UI State
	let isConnected = $state(false);
	let isRecording = $state(false);
	let isWasmLoading = $state(false);
	let isWasmReady = $state(false);
	let initializationStatusKey = $state(''); // Store translation key, not translated string
	let connectionError = $state('');
	let microphoneError = $state('');
	let vadError = $state('');

	// Derived state for localized status
	let initializationStatus = $derived(initializationStatusKey ? $_(initializationStatusKey) : '');


	// Transcript state
	let transcript = $state('');
	let partialTranscript = $state('');
	// Primary languages with dedicated models
	const primaryLanguages = ['et', 'en-80ms', 'en-1040ms'];
	// Other languages supported by Parakeet TDT (sorted alphabetically)
	const parakeetLanguages = [
		'bg', 'cs', 'da', 'de', 'el', 'es', 'fi', 'fr', 'hr', 'hu', 'it',
		'lt', 'lv', 'mt', 'nl', 'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sv', 'uk'
	];
	let selectedLanguage = $state('et'); // Default to Estonian
	let availableModels = $state<string[]>([]);

	// Cookie helpers for client-side language persistence
	function getCookie(name: string): string | null {
		if (!browser) return null;
		const value = `; ${document.cookie}`;
		const parts = value.split(`; ${name}=`);
		if (parts.length === 2) {
			return parts.pop()?.split(';').shift() || null;
		}
		return null;
	}

	function setCookie(name: string, value: string, days: number = 365) {
		if (!browser) return;
		const expires = new Date();
		expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
		document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Strict`;
	}

	// ═══════════════════════════════════════════════════════════════
	// MODEL TYPE HELPERS
	// ═══════════════════════════════════════════════════════════════

	/**
	 * Determine if the selected language uses an offline model (Parakeet TDT).
	 *
	 * STREAMING MODELS (ET/EN):
	 * - Continuous session (no [Session Ended])
	 * - Session ID stable until user stops
	 *
	 * PSEUDO-STREAMING MODELS (Parakeet TDT for other languages):
	 * - ~2-4 second latency
	 * - Session ID changes as chunks are processed
	 */
	function isOfflineModel(language: string): boolean {
		return language !== 'et' && !language.startsWith('en-');
	}

	/**
	 * Check if the selected language uses a fastconformer EN model.
	 */
	function isFastconformerEnModel(language: string): boolean {
		return language.startsWith('en-');
	}

	/**
	 * Get the server language code for the selected language.
	 */
	function getServerLanguage(language: string): string {
		if (language === 'en-80ms') return 'fastconformer_ctc_en_80ms';
		if (language === 'en-1040ms') return 'fastconformer_ctc_en_1040ms';
		if (isOfflineModel(language)) return 'parakeet_tdt_v3';
		return language; // 'et' passed as-is
	}

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
			et: '🇪🇪', 'en-80ms': '🇬🇧', 'en-1040ms': '🇬🇧', bg: '🇧🇬', cs: '🇨🇿', da: '🇩🇰', de: '🇩🇪',
			el: '🇬🇷', es: '🇪🇸', fi: '🇫🇮', fr: '🇫🇷', hr: '🇭🇷', hu: '🇭🇺',
			it: '🇮🇹', lt: '🇱🇹', lv: '🇱🇻', mt: '🇲🇹', nl: '🇳🇱', pl: '🇵🇱',
			pt: '🇵🇹', ro: '🇷🇴', ru: '🇷🇺', sk: '🇸🇰', sl: '🇸🇮', sv: '🇸🇪', uk: '🇺🇦'
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

	// Initialize VAD separately
	async function initializeVAD() {
		console.log('[INIT-VAD] Initializing VAD...');
		isWasmLoading = true;

		vad = await MicVAD.new({
			// Speech detection thresholds
			positiveSpeechThreshold: 0.5,  // Lowered from 0.6 for better sensitivity
			negativeSpeechThreshold: 0.35, // Lowered from 0.4
			preSpeechPadFrames: 10,
			redemptionFrames: 8,
			minSpeechFrames: 3,

			// Callbacks
			onFrameProcessed: (probabilities, frame: Float32Array) => {
				frameCount++;

				if (DEBUG_VAD) {
					// Log every frame for first 100 frames to debug initialization
					if (frameCount <= 100) {
						console.log(`[VAD] Frame #${frameCount} - prob: ${probabilities.isSpeech.toFixed(3)}, recording: ${isRecording}, speaking: ${isSpeaking}`);
					}
					// Then log periodically
					else if (frameCount % 50 === 0) {
						console.log(`[VAD] Frame #${frameCount} - still receiving frames`);
					}
				}

				// Buffer frames for pre-speech
				audioBuffer.push(new Float32Array(frame));
				if (audioBuffer.length > FRAMES_TO_BUFFER) {
					audioBuffer.shift();
				}

				// Stream audio frames to server when VAD detects speech
				if (isSpeaking) {
					sendAudio(frame);
				}
			},

			onSpeechStart: () => {
				if (DEBUG_VAD) console.log('🎤 [VAD] Speech started - sending pre-speech buffer');
				isSpeaking = true;

				// Send pre-speech buffer
				for (const bufferedFrame of audioBuffer) {
					sendAudio(bufferedFrame);
				}
				audioBuffer = [];
			},

			onSpeechEnd: (audio: Float32Array) => {
				if (DEBUG_VAD) console.log('🔇 [VAD] Speech ended, audio length:', audio.length);
				isSpeaking = false;

				// Note: We don't send utterance_end anymore
				// - For streaming models (ET/EN): Sessions should stay open across pauses
				// - For pseudo-streaming models (Parakeet): Chunks auto-process every 1.6s without needing utterance_end
			},

			onVADMisfire: () => {
				if (DEBUG_VAD) console.log('⚠️ [VAD] VAD misfire detected');
				isSpeaking = false;
			},

			// Error callback
			onError: (error: any) => {
				console.error('❌ [VAD] Error:', error);
				vadError = $_('dictate.vadError') + ': ' + (error.message || error);
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
		console.log('[INIT-VAD] ✓ VAD initialized successfully');
	}

	// Initialize system: pre-load WASM and connect WebSocket
	async function initializeSystem() {
		try {
			console.log('[INIT] Starting system initialization...');

			// Step 1: Connect to WebSocket
			initializationStatusKey = 'dictate.connectingToServer';
			console.log('[INIT] Connecting to WebSocket:', WS_URL);
			await connectWebSocket();
			await new Promise((resolve) => setTimeout(resolve, 500));

			if (!isConnected) {
				vadError = $_('dictate.failedToConnect');
				console.error('[INIT] Failed to connect to WebSocket server');
				return;
			}
			console.log('[INIT] ✓ WebSocket connected');

			// Step 2: Pre-load VAD WASM models
			initializationStatusKey = 'dictate.loadingVadModel';
			console.log('[INIT] Loading VAD WASM models...');

			await initializeVAD();

			initializationStatusKey = 'dictate.readyToRecord';
			console.log('[INIT] ✓ VAD WASM loaded successfully');
			console.log('[INIT] ✓ System initialized and ready to record');
		} catch (error: any) {
			console.error('[INIT] ❌ Failed to initialize system:', error);
			console.error('[INIT] Error details:', {
				name: error.name,
				message: error.message,
				stack: error.stack
			});
			isWasmLoading = false;
			isWasmReady = false;

			if (error.message?.includes('vad') || error.message?.includes('onnx')) {
				vadError = $_('dictate.failedToLoadVadModel');
			} else {
				vadError = error.message || $_('dictate.initializationFailed');
			}
			initializationStatusKey = 'dictate.initializationFailed';
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

	// ═══════════════════════════════════════════════════════════════
	// STREAMING MODEL HANDLERS (ET/EN)
	// ═══════════════════════════════════════════════════════════════

	/**
	 * Handle transcript messages for streaming models (ET/EN).
	 * Both use cumulative streaming - returns full hypothesis each time, replace partial.
	 */
	function handleTranscript_streaming(message: any) {
		console.log('[STREAMING] Received transcript:', message.text, 'is_final:', message.is_final);

		if (message.is_final) {
			// Check for unexpected session end (should not happen for streaming, but handle gracefully)
			if (message.text.trim() === '[Session Ended]') {
				console.warn('[STREAMING] ⚠️  Server ended session unexpectedly (possibly timeout). Creating new session...');
				// Save the partial transcript to final before starting new session
				if (partialTranscript.trim()) {
					transcript += (transcript ? ' ' : '') + partialTranscript.trim();
				}
				partialTranscript = '';

				// Clear old session ID immediately so audio won't be sent until new session is ready
				sessionId = null;

				// If still recording, start a new session immediately
				if (isRecording) {
					const language = getServerLanguage(selectedLanguage);
					console.log('[STREAMING] Sending new start message with language:', language);
					sendMessage({
						type: 'start',
						sample_rate: SAMPLE_RATE,
						format: 'pcm',
						language: language
					});
				}
				return;
			}

			// Add to final transcript
			if (message.text.trim()) {
				console.log('[STREAMING] Adding to final transcript:', message.text.trim());
				transcript += (transcript ? ' ' : '') + message.text.trim();
			}
			partialTranscript = '';
		} else {
			// Replace with full hypothesis (cumulative streaming)
			if (message.text.trim() || !partialTranscript) {
				partialTranscript = message.text;
			} else {
				console.log('[STREAMING] Ignoring empty partial transcript - keeping existing text');
			}
		}
	}

	/**
	 * Handle error messages for streaming models.
	 * Suppress "Session not found" during unexpected session transitions.
	 */
	function handleError_streaming(message: any) {
		console.error('[STREAMING] Server error:', message.message);

		// Suppress "Session not found" errors during session transitions
		// (can occur if server unexpectedly ends session due to timeout)
		if (message.message && message.message.includes('Session not found') && isRecording) {
			console.log('[STREAMING] Session not found (during session transition) - suppressing');
			return;
		}

		connectionError = message.message;
	}

	/**
	 * Handle session ready for streaming models.
	 * Streaming sessions stay open continuously until user stops or timeout.
	 */
	function handleSessionReady_streaming(sessionIdReceived: string) {
		sessionId = sessionIdReceived;
		console.log('[STREAMING] Session ready:', sessionId);
	}

	/**
	 * Handle all server messages for streaming models (ET/EN).
	 */
	function handleServerMessage_streaming(message: any) {
		switch (message.type) {
			case 'ready':
				handleSessionReady_streaming(message.session_id);
				if (message.available_models) {
					availableModels = message.available_models;
				}
				break;

			case 'transcript':
				handleTranscript_streaming(message);
				break;

			case 'error':
				handleError_streaming(message);
				break;

			case 'session_ended':
				console.log('[STREAMING] Session ended by server:', message.session_id);
				sessionId = null;
				break;
		}
	}

	// ═══════════════════════════════════════════════════════════════
	// FASTCONFORMER EN HANDLERS (FINAL-ONLY, LIKE ZIPFORMER)
	// ═══════════════════════════════════════════════════════════════

	/**
	 * Handle transcript messages for fastconformer_ctc_en_1040ms model.
	 * This model returns only NEW text segments (not cumulative).
	 * Each message is appended directly to transcript - no deduplication needed.
	 */
	function handleTranscript_fastconformer_en(message: any) {
		console.log('[FASTCONFORMER-EN] Received transcript:', message.text, 'is_final:', message.is_final);

		// Check for session end marker
		if (message.text.trim() === '[Session Ended]') {
			console.warn('[FASTCONFORMER-EN] ⚠️ Server ended session. Creating new session...');
			sessionId = null;

			if (isRecording) {
				const language = getServerLanguage(selectedLanguage);
				console.log('[FASTCONFORMER-EN] Sending new start message with language:', language);
				sendMessage({
					type: 'start',
					sample_rate: SAMPLE_RATE,
					format: 'pcm',
					language: language
				});
			}
			return;
		}

		// Append new text directly to transcript (no deduplication - each message is unique)
		const newText = message.text.trim();
		if (newText) {
			console.log('[FASTCONFORMER-EN] Appending new text:', newText);
			if (!transcript) {
				transcript = newText;
			} else if (newText.match(/^[.?!,;:]/)) {
				// No space before punctuation
				transcript += newText;
			} else {
				transcript += ' ' + newText;
			}
		}
	}

	/**
	 * Handle all server messages for fastconformer_en model.
	 */
	function handleServerMessage_fastconformer_en(message: any) {
		switch (message.type) {
			case 'ready':
				sessionId = message.session_id;
				console.log('[FASTCONFORMER-EN] Session ready:', sessionId);
				if (message.available_models) {
					availableModels = message.available_models;
				}
				break;

			case 'transcript':
				handleTranscript_fastconformer_en(message);
				break;

			case 'error':
				console.error('[FASTCONFORMER-EN] Server error:', message.message);
				if (message.message && message.message.includes('Session not found') && isRecording) {
					console.log('[FASTCONFORMER-EN] Session not found (during transition) - suppressing');
					return;
				}
				connectionError = message.message;
				break;

			case 'session_ended':
				console.log('[FASTCONFORMER-EN] Session ended by server:', message.session_id);
				sessionId = null;
				break;
		}
	}

	// ═══════════════════════════════════════════════════════════════
	// OFFLINE MODEL HANDLERS (PARAKEET)
	// ═══════════════════════════════════════════════════════════════

	/**
	 * Handle transcript messages for pseudo-streaming models (Parakeet).
	 * Backend sends CUMULATIVE text (not deltas), so we replace partialTranscript.
	 */
	function handleTranscript_offline(message: any) {
		console.log('[PSEUDO-STREAM] Received transcript:', message.text, 'is_final:', message.is_final);

		if (message.is_final) {
			// Check if server is ending the session (chunk processed)
			if (message.text.trim() === '[Session Ended]') {
				console.log('[PSEUDO-STREAM] Server ended session (chunk complete).');
				// Only restart session if still recording
				if (isRecording) {
					// Move cumulative partial to final transcript
					if (partialTranscript.trim()) {
						transcript = partialTranscript.trim();
					}
					partialTranscript = '';

					const language = getServerLanguage(selectedLanguage);
					console.log('[OFFLINE] Sending new start message with language:', language);
					sendMessage({
						type: 'start',
						sample_rate: SAMPLE_RATE,
						format: 'pcm',
						language: language
					});
				} else {
					console.log('[PSEUDO-STREAM] Not recording - ignoring session end');
				}
				return;
			}

			// Accept final results even after stop (for pending buffer processing)
			if (message.text.trim()) {
				console.log('[PSEUDO-STREAM] Received final result:', message.text.trim());
				// Update partial transcript with the final cumulative result
				// stopRecording will combine transcript + partialTranscript
				partialTranscript = message.text.trim();
			}
		} else {
			// Partial results (is_final: false) - only process if still recording
			if (isRecording) {
				console.log('[PSEUDO-STREAM] Replacing partial with cumulative text:', message.text);
				partialTranscript = message.text;
			} else {
				console.log('[PSEUDO-STREAM] Ignoring partial message after stop');
			}
		}
	}

	/**
	 * Handle error messages for pseudo-streaming models.
	 * Suppress "Session not found" errors during session transitions.
	 */
	function handleError_offline(message: any) {
		console.error('[PSEUDO-STREAM] Server error:', message.message);

		// Check if error is "Session not found" during chunk chaining
		if (message.message && message.message.includes('Session not found') && isRecording) {
			console.log('[PSEUDO-STREAM] Session not found (during chunk transition) - suppressing');
			return;
		}

		connectionError = message.message;
	}

	/**
	 * Handle session ready for pseudo-streaming models.
	 * Pseudo-streaming models process chunks every 1.6s with overlapping windows.
	 */
	function handleSessionReady_offline(sessionIdReceived: string) {
		sessionId = sessionIdReceived;
		console.log('[PSEUDO-STREAM] Session ready:', sessionId);
	}

	/**
	 * Handle all server messages for pseudo-streaming models (Parakeet).
	 */
	function handleServerMessage_offline(message: any) {
		switch (message.type) {
			case 'ready':
				handleSessionReady_offline(message.session_id);
				if (message.available_models) {
					availableModels = message.available_models;
				}
				break;

			case 'transcript':
				handleTranscript_offline(message);
				break;

			case 'error':
				handleError_offline(message);
				break;

			case 'session_ended':
				console.log('[PSEUDO-STREAM] Session ended by server:', message.session_id);
				// Don't clear sessionId yet - keep it for audio sending during transition
				console.log('[PSEUDO-STREAM] Keeping session ID for transition...');
				break;
		}
	}

	// ═══════════════════════════════════════════════════════════════
	// MAIN MESSAGE HANDLER (DELEGATES TO STREAMING OR OFFLINE)
	// ═══════════════════════════════════════════════════════════════

	/**
	 * Main server message handler - delegates to streaming, fastconformer_en, or offline handlers.
	 */
	function handleServerMessage(message: any) {
		console.log('Received message:', message);

		// Delegate to appropriate handler based on model type
		if (isOfflineModel(selectedLanguage)) {
			handleServerMessage_offline(message);
		} else if (isFastconformerEnModel(selectedLanguage)) {
			// English uses fastconformer which only returns final text
			handleServerMessage_fastconformer_en(message);
		} else {
			// Estonian uses zipformer with cumulative streaming
			handleServerMessage_streaming(message);
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

		// Don't send audio if session has ended
		if (!sessionId) {
			console.warn('[AUDIO] Skipping audio send - no active session');
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

			console.log('[START] Starting recording...');

			if (!isConnected || !ws) {
				connectionError = $_('dictate.noConnections');
				console.error('[START] Not connected to server');
				return;
			}

			// Reinitialize VAD if it was destroyed
			// Always destroy and recreate VAD for fresh initialization
			// (MicVAD has timing issues if reused across multiple recordings)
			if (vad) {
				console.log('[START] Destroying previous VAD instance...');
				try {
					vad.destroy();
				} catch (e) {
					console.warn('[START] Error destroying VAD:', e);
				}
				vad = null;
			}

			console.log('[START] Creating fresh VAD instance...');
			isWasmReady = false;
			await initializeVAD();

			// Ensure VAD is ready
			if (!isWasmReady || !vad) {
				vadError = $_('dictate.failedToInitializeVoiceDetection');
				console.error('[START] VAD initialization failed');
				return;
			}

			// Send start message to establish session
			const language = getServerLanguage(selectedLanguage);
			const modelType = isOfflineModel(selectedLanguage) ? 'PSEUDO-STREAMING' : 'STREAMING';
			console.log(`[START] [${modelType}] Sending start message with language:`, language);
			sendMessage({
				type: 'start',
				sample_rate: SAMPLE_RATE,
				format: 'pcm',
				language: language
			});

			// Reset frame counter for this recording session
			frameCount = 0;
			console.log('[START] Frame counter reset to 0');

			// Start the already-initialized VAD (requests microphone access)
			console.log('[START] Calling vad.start()...');
			console.log('[START] Frame count before start:', frameCount);
			await vad.start();
			console.log('[START] vad.start() completed');

			isVadActive = true;
			isRecording = true;

			// Verify microphone is working by checking if we have an audio stream
			// MicVAD stores the stream internally, but we can check via callbacks
			console.log('[START] ✓ Recording started. Waiting for first audio frame...');
			console.log('[START] State: isRecording =', isRecording, 'isVadActive =', isVadActive, 'isSpeaking =', isSpeaking);

			// Diagnostic: Check if we're receiving audio frames (doesn't stop recording)
			setTimeout(() => {
				if (isRecording) {
					console.log('[START] Frame count after 3s:', frameCount);
					if (audioBuffer.length === 0 && frameCount === 0) {
						console.error('[START] ❌ No audio frames received - VAD is not processing audio!');
						console.error('[START] This indicates microphone permission issue or worklet not loaded.');
					} else if (audioBuffer.length === 0 && frameCount > 0) {
						console.warn('[START] ⚠️ Frames processed but buffer empty (frames:', frameCount, ')');
					} else {
						console.log('[START] ✓ VAD working! Received', audioBuffer.length, 'audio frames, processed', frameCount, 'total frames.');
					}
				}
			}, 3000);
		} catch (error: any) {
			console.error('[START] ❌ Failed to start recording:', error);
			console.error('[START] Error details:', {
				name: error.name,
				message: error.message,
				stack: error.stack
			});

			if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
				microphoneError = $_('dictate.providePermission');
			} else if (error.name === 'NotFoundError') {
				microphoneError = $_('dictate.noMicrophoneFound');
			} else if (error.name === 'NotReadableError') {
				microphoneError = $_('dictate.microphoneInUse');
			} else {
				microphoneError = error.message || $_('dictate.initializationFailed');
			}
			stopRecording();
		}
	}

	// Stop recording
	async function stopRecording() {
		isRecording = false;
		isVadActive = false;
		isSpeaking = false;

		// Destroy VAD - will be recreated on next start
		if (vad) {
			try {
				vad.destroy();
				vad = null;
			} catch (error) {
				console.error('Error destroying VAD:', error);
			}
		}

		// Clear audio buffer for next recording
		audioBuffer = [];

		// Send stop message
		if (ws && ws.readyState === WebSocket.OPEN && sessionId) {
			sendMessage({ type: 'stop' });
		}

		// Wait for final results from pseudo-streaming models
		// Server needs time to process remaining buffer (< 4s window) before finalizing
		// Pseudo-streaming: wait up to 6s for final result, or until final message arrives
		// True streaming: wait 1s for final result
		const isOffline = isOfflineModel(selectedLanguage);
		const maxWaitTime = isOffline ? 6000 : 1000;

		// Store initial partial transcript to detect when new final result arrives
		const initialPartial = partialTranscript;
		const startWait = Date.now();

		// Poll for new results or timeout
		while (Date.now() - startWait < maxWaitTime) {
			// If partial transcript changed, we got a final result
			if (isOffline && partialTranscript !== initialPartial) {
				break;
			}
			await new Promise(resolve => setTimeout(resolve, 200)); // Check every 200ms
		}

		// Combine final and partial transcripts
		const finalText = (transcript + ' ' + partialTranscript).trim();

		if (finalText) {
			const newRecording: Recording = {
				id: Date.now().toString(),
				text: finalText,
				timestamp: new Date()
			};
			pastRecordings = [newRecording, ...pastRecordings];
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
		// Load language preference from cookie (default to 'et' if not set)
		const savedLanguage = getCookie('dictate_language');
		if (savedLanguage) {
			// Validate that the saved language is still supported
			const allLanguages = [...primaryLanguages, 'auto', ...parakeetLanguages];
			if (allLanguages.includes(savedLanguage)) {
				selectedLanguage = savedLanguage;
			}
		}

		initializeSystem();
	});

	// Save language preference to cookie when it changes
	$effect(() => {
		if (browser && selectedLanguage) {
			setCookie('dictate_language', selectedLanguage);
		}
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

<div class="bg-base-100">
	<div class="container mx-auto px-4 py-8 max-w-4xl">
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
			<!-- Status Badge - Top Right (Connection Status or VAD Status) -->
			<div class="absolute top-4 right-4">
				{#if isRecording}
					<!-- VAD Status when recording -->
					<div class="badge gap-2 p-3" class:badge-info={!isSpeaking} class:badge-success={isSpeaking}>
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
								d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						{#if isSpeaking}
							<span>{$_('dictate.speakingDetected')}</span>
						{:else}
							<span>{$_('dictate.listeningForSpeech')}</span>
						{/if}
					</div>
				{:else if isWasmLoading || !isWasmReady}
					<!-- Connection status when not recording -->
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
						class="select select-lg w-full text-center text-lg"
						bind:value={selectedLanguage}
						disabled={isRecording}
					>
						<!-- Primary languages with dedicated models -->
						{#each primaryLanguages as lang}
							<option value={lang}>{getFlagEmoji(lang)} {$_(`dictate.languages.${lang}`)}</option>
						{/each}
						<!-- Divider -->
						<option disabled>──────────────────</option>
						<!-- Auto-detect for all other European languages -->
						<option value="auto">🌍 {$_('dictate.languages.auto')}</option>
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
				class="bg-base-100 rounded-lg p-6 min-h-[80px] font-mono text-sm whitespace-pre-wrap"
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
	</div>
</div>
