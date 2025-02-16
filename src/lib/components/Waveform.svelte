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
		if ($waveform && $waveform.segments) {
				$waveform.segments.removeAll();
				names.forEach((m) => {
					$waveform.segments.add(m);
				});
			} else console.log("not ready", names)
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
		console.log("updated", speakers)
		});
	onMount(() => {
		const audioContext = new AudioContext();
		console.log(names)
		const options: PeaksOptions = {
			segmentOptions: {
					// Enable segment markers
					markers: true,

					// Enable segment overlays
					overlay: true,

					// Color for segment start marker handles
					startMarkerColor: 'orange',

					// Color for segment end marker handles
					endMarkerColor: 'orange',
					
					// Segment waveform color
					waveformColor: 'orange',

					// Segment overlay color
					overlayColor: 'blue',

					// Segment overlay opacity
					overlayOpacity: 0.2,

					// Segment overlay border color
					overlayBorderColor: 'blue',

					// Segment overlay border width
					overlayBorderWidth: 2,

					// Segment overlay border corner radius
					overlayCornerRadius: 5,

					// Segment overlay offset from the top and bottom of the waveform view, in pixels
					overlayOffset: 2,

					// Segment overlay label alignment, either 'top-left' or 'center'
					overlayLabelAlign: 'left',

					// Segment overlay label offset, in pixels
					overlayLabelPadding: 2,

					// Segment overlay label color
					overlayLabelColor: 'black',

					// Segment overlay font family
					overlayFontFamily: 'sans-serif',

					// Segment overlay font size
					overlayFontSize: 10,

					// Segment overlay font style
					overlayFontStyle: 'bold'
				},
			zoomview: {
				container: document.getElementById('zoomview-container'),
				waveformColor: 'violet',
				playedWaveformColor: 'purple',
				playheadColor: 'orange',
				playheadTextColor: '#aaa',
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
				container: document.getElementById('overview-container'),
				playedWaveformColor: '#e5c9fb',
				highlightColor: 'grey',
				highlightStrokeColor:  'transparent',
				enablePoints: false,
				enableSegments: true,
			},
			mediaElement: document.getElementById('audio'),
			webAudio: {
				audioContext: audioContext,
				scale: 128,
				multiChannel: false
			},
			withCredentials: true,
			zoomLevels: [512, 1024, 2048, 4096],
			keyboard: true,
			nudgeIncrement: 0.01,
			emitCueEvents: false, // enter segment event for example
			/* points: [
				{
				time: 150,
				editable: true,
				labelText: "A point"
				},
				{
				time: 160,
				editable: true,
				labelText: "Another point"
				}
			], */
			
		};

		Peaks.init(options, function(err, peaks) {
		// Do something when the waveform is displayed and ready, or handle errors
			if(err) console.log("Error initiating Peaks", err);
			peaksInstance = peaks;
			if (peaksInstance)	waveform.set(peaksInstance);
			// Event subscriptions
			peaksInstance.on('peaks.ready', function () {
				peaksReady = true;
				duration.set(peaksInstance.player.getDuration());
				peaksInstance.player.pause();
				player.update((x) => {
					return { ...x, ready: true };
				});
			});
			peaksInstance.on('player.playing', function() {
				player.update((x) => {
					return { ...x, playing: true };
				});
			});
			peaksInstance.on('player.pause', function() {
				player.update((x) => {
					return { ...x, playing: false };
				});
			});
			peaksInstance.on('segments.enter', function (event) {
				const progress = Math.round($waveform.player.getCurrentTime() * 100) / 100;
				playingTime.set(progress);
				console.log("entered segment");
				if ($editor) {
					// Apply word color decoration change to state without adding this state change to the history stack.
					let newState = $editor.view.state.apply(
						$editor.view.state.tr
							.setMeta('wordColor', {
								id: event.segment.id,
	/* 							start: region.start,
								end: region.end, */
								event: 'in'
							})
							.setMeta('addToHistory', false)
					);
					console.log("entered segment", event.segment.id)
					$editor.view.updateState(newState);
				}
			});
			peaksInstance.on('segments.click', function(event) {
				console.log(`Segment clicked: ${event.segment.id}`);
			});
			peaksInstance.on('player.seeked', (time) => {
				playingTime.set(time);
			});
		});
		

		// Subscribe to playback events
		let audio = document.getElementById("audio") as HTMLMediaElement;
		audio.ontimeupdate = function() {onPlayback()};
		function onPlayback() {
			const candidateWords = wordLookup[Math.floor(audio.currentTime)];
			let currentWord;
			if (candidateWords)	currentWord = candidateWords.find(w => w.start <= audio.currentTime && w.end >= audio.currentTime)
			if (!currentWord || currentWord.id != lastHighlighedWord.id) {
				let progress = 0;
				if ($waveform && $waveform.player) progress = Math.round($waveform.player.getCurrentTime() * 100) / 100;
				playingTime.set(progress);
				if ($editor) {
					// Apply word color decoration change to state without adding this state change to the history stack.
					let newState = $editor.view.state.apply(
						$editor.view.state.tr
							// TODO: pass ID instead of progress
							// TODO: fire at region start, end and player seek events
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
				const progress = Math.round($waveform.player.getCurrentTime() * 100) / 100;
				playingTime.set(progress);
				if ($editor) {
				// Apply word color decoration change to state without adding this state change to the history stack.
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
		/* ws = WaveSurfer.create({
			container: '#waveform',
			waveColor: 'violet',
			progressColor: 'purple',
			autoCenter: true,
			// bargap: 1,
			// barWidth: 3,
			normalize: true,
			height: 80,
			fillParent: true,
			hideScrollbar: false,	
			plugins: [
				TimelinePlugin.create({
					container: '#wave-timeline'
				}),
			]
		});
		wsRegions = ws.registerPlugin(RegionsPlugin.create());
		regions.forEach((r) => {
			wsRegions.addRegion(r);
		});
		names.forEach((r) => {
			wsRegions.addRegion(r);
		});
		ws.load(url);
		wavesurfer.set(ws);

		wsRegions.on('region-in', function (region) {
			const progress = Math.round($wavesurfer.getCurrentTime() * 100) / 100;
			playingTime.set(progress);
			if ($editor) {
				// Apply word color decoration change to state without adding this state change to the history stack.
				let newState = $editor.view.state.apply(
					$editor.view.state.tr
						.setMeta('wordColor', {
							id: region.id,
							start: region.start,
							end: region.end,
							event: 'in'
						})
						.setMeta('addToHistory', false)
				);
				$editor.view.updateState(newState);
			}
		});
		wsRegions.on('region-out', function (region) {
			const progress = Math.round($wavesurfer.getCurrentTime() * 100) / 100;
			playingTime.set(progress);
			if ($editor) {
				// Apply word color decoration change to state without adding this state change to the history stack.
				let newState = $editor.view.state.apply(
					$editor.view.state.tr
						// TODO: pass ID instead of progress
						// TODO: fire at region start, end and player seek events
						.setMeta('wordColor', {
							id: region.id,
							start: region.start,
							end: region.end,
							event: 'out'
						})
						.setMeta('addToHistory', false)
				);
				$editor.view.updateState(newState);
			}
		});

		// Event subscriptions
		$wavesurfer.on('ready', function () {
			console.log('ready');
			ws.zoom(zoom);
			peaksReady = true;
			duration.set($wavesurfer.getDuration());
			$wavesurfer.pause();
			player.update((x) => {
				return { ...x, ready: true };
			});
			peaksInstance.player.play();
		});

		$wavesurfer.on('play', function () {
			console.log('play');
			player.update((x) => {
				return { ...x, playing: true };
			});
		});
		$wavesurfer.on('pause', function () {
			console.log('pause');
			player.update((x) => {
				return { ...x, playing: false };
			});
		});

		$wavesurfer.on('seek', () => {
			console.log('seek');
			const progress = Math.round($wavesurfer.getCurrentTime() * 100) / 100;
			if (progress !== $playingTime) {
				playingTime.set(progress);
			}
		});
		$wavesurfer.on('mute', function () {
			player.update((x) => {
				return { ...x, muted: true };
			});
		});

		$wavesurfer.on('destroy', function () {
			peaksReady = false;
			player.set({ playing: false, muted: false, ready: false });
		}); */
	});

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
		$waveform.player.play();
	};
	export const pause = () => {
		$waveform.player.pause();
	};
</script>

<div>
	<div id="zoomview-container" class="waveform-container w-full"></div>
	<div id="overview-container" class="w-full h-auto "></div>
	<audio id="audio">
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
