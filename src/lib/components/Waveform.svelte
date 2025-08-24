<script lang="ts">
	import { run } from 'svelte/legacy';

	import { onMount, onDestroy } from 'svelte';
	import { beforeNavigate } from "$app/navigation";
	import {
		player,
		words,
		speakerNames,
		playingTime,
		duration,
		editor,
		waveform
	} from '$lib/stores.svelte';
	import Peaks, { type PeaksInstance, type PeaksOptions } from 'peaks.js';
	let { url } = $props();

	let peaksInstance: PeaksInstance;
	let peaksReady = false;
	const wordFilter = (w) => w && w.id && w.start && w.end;
	/* $: wordSegments = $words.filter(wordFilter).map((word) => {
		return {
			id: word.id,
			startTime: word.start,
			endTime: word.end,
		};
	}); */
	let wordLookup = [[]];
	let lastHighlighedWord = {
		id: "",
		start: 0,
		end: 0,
		highlight: false
	};
	words.subscribe(function (w) {
		let max = 0;
		if (w.length > 0 && w[w.length-1].end) max = Math.floor(w[w.length-1].end);
		for (let i = 0; i <= max; i++) {
			wordLookup[i] = [];
		};
		let i = 0;
		while (i < w.length) {
			if (w[i].start && w[i].end && w[i].id) {
				const start = Math.floor(w[i].start);
				const end = Math.floor(w[i].end);
				for (let y = start; y <= end; y++) {
					if (!wordLookup[y].find(el=>el.id === w[i].id)) {
						wordLookup[y].push(w[i])
					};
				};
			}
			i += 1;
		}
	});
	let names = $state();
run(() => {
		if ($waveform && $waveform.segments && Array.isArray(names)) {
				try { $waveform.segments.removeAll(); } catch {}
				names.forEach((m) => {
					try { $waveform.segments.add(m); } catch {}
				});
		}
	});
	const speakerFilter = (s) => s && s.start && s.start !== -1 && s.end && s.end !== -1 && s.name;
	const unsubscribeSpeakerNames = speakerNames.subscribe((speakers) => {
		names = speakers
			.filter(speakerFilter)
			.sort((a, b) => (a.start > b.start ? 1 : -1))
			.map((speaker, i) => {
				return {
					startTime: speaker.start,
					endTime: speaker.end,
					labelText: speaker.name,
					editable: true,
				};
			});
		// console.log("updated", speakers)
		});

let zoomviewEl: HTMLDivElement;
let overviewEl: HTMLDivElement;
let resizeObs: ResizeObserver;
let audioEl: HTMLAudioElement;

function buildOptions(): PeaksOptions {
	// Guard against SSR and ensure media element refs exist
	if (typeof document === 'undefined' || typeof window === 'undefined') {
		return null as any;
	}
	if (!audioEl || !zoomviewEl || !overviewEl) {
		return null as any;
	}
	
	let styles = getComputedStyle(document.documentElement);
	let colorPrimary = styles.getPropertyValue("--color-primary");
	let colorSecondary = styles.getPropertyValue("--color-secondary");
	let colorAccent = styles.getPropertyValue("--color-accent");
	let colorBase = styles.getPropertyValue("--color-base-100");
	let colorNeutral = styles.getPropertyValue("--color-neutral");
	const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
	return {
		segmentOptions: {
			markers: true,
			overlay: true,
			startMarkerColor: colorAccent,
			endMarkerColor: colorAccent,
			waveformColor: colorAccent,
			overlayColor: colorSecondary,
			overlayOpacity: 0.1,
			overlayBorderColor: colorSecondary,
			overlayBorderWidth: 2,
			overlayCornerRadius: 5,
			overlayOffset: 2,
			overlayLabelAlign: 'left',
			overlayLabelPadding: 2,
			overlayLabelColor: 'black',
			overlayFontFamily: 'sans-serif',
			overlayFontSize: 10,
			overlayFontStyle: 'bold'
		},
		zoomview: {
			container: zoomviewEl,
			waveformColor: colorNeutral,
			playedWaveformColor: colorPrimary,
			playheadColor: colorAccent,
			playheadTextColor: colorBase,
			playheadClickTolerance: 3,
			showPlayheadTime: true,
			timeLabelPrecision: 2,
			// @ts-ignore
			axisTopMarkerHeight: 5,
			axisBottomMarkerHeight: 5,
			autoScroll: true,
			autoScrollOffset: 100,
			enablePoints: false,
			enableSegments: true,
			segmentOptions: {
				overlayOpacity: 0.1,
			}
		},
		overview: {
			container: overviewEl,
			playedWaveformColor: colorPrimary,
			highlightColor: colorNeutral,
			highlightStrokeColor: 'transparent',
			enablePoints: false,
			enableSegments: true,
		},
		mediaElement: audioEl,
		webAudio: {
			audioContext: audioContext,
			scale: 128,
			multiChannel: false
		},
		withCredentials: true,
		zoomLevels: [512, 1024, 2048, 4096],
		keyboard: true,
		nudgeIncrement: 0.01,
		emitCueEvents: false,
	};
}

function initPeaks() {
		const options = buildOptions();
		if (!options) {
			console.warn('Cannot initialize Peaks.js: options unavailable');
			return;
		}
		Peaks.init(options, function(err, peaks) {
			if (err) {
				console.log("Error initiating Peaks", err);
				return;
			}
			peaksInstance = peaks;
			if (peaksInstance) waveform.set(peaksInstance);
			// Event subscriptions
			peaksInstance.on('peaks.ready', function () {
				peaksReady = true;
				try { duration.set(peaksInstance.player.getDuration()); } catch {}
				try { peaksInstance.player.pause(); } catch {}
				player.update((x) => ({ ...x, ready: true }));
			});
			peaksInstance.on('player.playing', function() {
				player.update((x) => ({ ...x, playing: true }));
			});
			peaksInstance.on('player.pause', function() {
				player.update((x) => ({ ...x, playing: false }));
			});
			peaksInstance.on('segments.enter', function (event) {
				const progress = Math.round((($waveform?.player?.getCurrentTime?.() || 0)) * 100) / 100;
				playingTime.set(progress);
				if ($editor) {
					let newState = $editor.view.state.apply(
						$editor.view.state.tr
							.setMeta('wordColor', {
								id: event.segment.id,
								event: 'in'
							})
							.setMeta('addToHistory', false)
					);
					$editor.view.updateState(newState);
				}
			});
			peaksInstance.on('segments.click', function(event) {
				// console.log(`Segment clicked: ${event.segment.id}`);
			});
			peaksInstance.on('player.seeked', (time) => {
				playingTime.set(time);
			});
		});
	}

onMount(() => {
		// Ensure refs are available (audio & containers) before init
		const tryInit = () => {
			if (!audioEl || !zoomviewEl || !overviewEl) {
				requestAnimationFrame(tryInit);
				return;
			}
			initPeaks();
			// Observe size changes to re-init Peaks so canvas fits container
			let debounce = 0;
			resizeObs = new ResizeObserver(() => {
				cancelAnimationFrame(debounce);
				debounce = requestAnimationFrame(() => {
					if (!peaksInstance) return;
					const currentTime = $waveform?.player?.getCurrentTime?.() || 0;
					const wasPlaying = !!$player.playing;
					try { peaksInstance.destroy(); } catch {}
					initPeaks();
					// restore time/play state after small delay to ensure ready
					setTimeout(() => {
						if ($waveform) {
							try { $waveform.player.seek(currentTime); } catch {}
							if (wasPlaying) { try { $waveform.player.play(); } catch {} }
						}
					}, 50);
				});
			});
			if (zoomviewEl) resizeObs.observe(zoomviewEl);
			// hook playback time updates
			audioEl.ontimeupdate = function() { onPlayback(); };
		};
		tryInit();
	});

	// Subscribe to playback events
	function onPlayback() {
		if (!audioEl) return;
		const now = audioEl.currentTime || 0;
		const candidateWords = wordLookup[Math.floor(now)];
		let currentWord;
		if (candidateWords) currentWord = candidateWords.find(w => w.start <= now && w.end >= now);
		if (!currentWord || currentWord.id != lastHighlighedWord.id) {
			let progress = 0;
			if ($waveform && $waveform.player) progress = Math.round($waveform.player.getCurrentTime() * 100) / 100;
			playingTime.set(progress);
			if ($editor) {
				let newState = $editor.view.state.apply(
					$editor.view.state.tr
						.setMeta('wordColor', {
							id: lastHighlighedWord.id,
							start: lastHighlighedWord.start,
							end: lastHighlighedWord.end,
							event: 'out'
						})
						.setMeta('addToHistory', false)
				);
				$editor.view.updateState(newState);
			}
			if (lastHighlighedWord.highlight) lastHighlighedWord.highlight = false;
		}
		if (currentWord && currentWord.id != lastHighlighedWord.id) {
			const progress = Math.round(($waveform?.player?.getCurrentTime?.() || 0) * 100) / 100;
			playingTime.set(progress);
			if ($editor) {
				let newState = $editor.view.state.apply(
					$editor.view.state.tr
					.setMeta('wordColor', {
						id: currentWord.id,
						start: currentWord.start,
						end: currentWord.end,
						event: 'in'
					})
					.setMeta('addToHistory', false)
				);
				$editor.view.updateState(newState);
			}
			lastHighlighedWord.id = currentWord.id;
			lastHighlighedWord.start = currentWord.start;
			lastHighlighedWord.end = currentWord.end;
			lastHighlighedWord.highlight = true;
		}
	}

	// Local state
	let playbackSpeed = 0;
	// let zoom = 50;

	// Local functions
	const setPlaybackSpeed = (speed: number) => (speed = playbackSpeed + speed);

	beforeNavigate( () => {
		// Removing this would cause a crash during away navigation
		unsubscribeSpeakerNames();
	}) 

onDestroy(() => {
		unsubscribeSpeakerNames();
		if (resizeObs) resizeObs.disconnect();
		if (audioEl) audioEl.ontimeupdate = null;
		if ($waveform) {
			$waveform.destroy();
		}
		waveform.set(null); 
		words.set([]);
		playingTime.set(0);
	});
	export const seekTo = (pos) => {
		if ($waveform && $waveform.player.getDuration() >= pos) {
			$waveform.player.seek(pos);
		}
	};
export const play = () => {
		try { $waveform?.player?.play?.(); } catch {}
	};
export const pause = () => {
		try { $waveform?.player?.pause?.(); } catch {}
	};
</script>

<div>
	<div id="zoomview-container" class="waveform-container w-full" bind:this={zoomviewEl}></div>
	<div id="overview-container" class="w-full h-auto " bind:this={overviewEl}></div>
<audio id="audio" bind:this={audioEl}>
		<source src={url} type="audio/mpeg">
	</audio>
</div>

<style>
	.waveform-container {
		margin: 2px auto;
		line-height: 0;
		overflow: clip;
	}
	#zoomview-container {
		height: 100px;
		margin: 0;
		line-height: 0;
	}

	#overview-container {
		height: 35px;
	}
</style>
