<script lang="ts">
	import WaveSurfer from 'wavesurfer.js';
	import { onMount, onDestroy } from 'svelte';
	import MinimapPlugin from 'wavesurfer.js/dist/plugin/wavesurfer.minimap.min.js';
	import MediasessionPlugin from 'wavesurfer.js/dist/plugin/wavesurfer.mediasession.min.js';
	import PlayheadPlugin from 'wavesurfer.js/dist/plugin/wavesurfer.playhead.min.js';
	import TimelinePlugin from 'wavesurfer.js/dist/plugin/wavesurfer.timeline.min.js';
	import CursorPlugin from 'wavesurfer.js/dist/plugin/wavesurfer.cursor.min.js';
	import RegionsPlugin from 'wavesurfer.js/dist/plugin/wavesurfer.regions.min.js';
	import MarkersPlugin from 'wavesurfer.js/dist/plugin/wavesurfer.markers.min.js';
	import {
		player,
		words,
		speakerNames,
		playingTime,
		duration,
		editor,
		wavesurfer
	} from '$lib/stores';
	export let url;
	export let peaks;

	let ws: WaveSurfer;
	let regions;
	let wavesurferReady = false;
	const wordFilter = (w) => w && w.id && w.start && w.end;
	$: regions = $words.filter(wordFilter).map((word) => {
		return {
			id: word.id,
			start: word.start,
			end: word.end,
			color: 'rgba(0, 0, 0, 0.5)',
			drag: false,
			resize: false
		};
	});
	let markers;
	const speakerFilter = (s) => s && s.start && s.start !== -1 && s.name;
	$: speakerNames.subscribe((speakers) => {
		markers = speakers
			.filter(speakerFilter)
			.sort((a, b) => (a.start > b.start ? 1 : -1))
			.map((speaker, i) => {
				return {
					time: speaker.start,
					label: speaker.name,
					color: '#FE621D',
					position: i & 1 ? 'top' : 'bottom'
				};
			});
		if ($wavesurfer && $wavesurfer.addMarker && wavesurferReady) {
			$wavesurfer.clearMarkers();
			markers.forEach((m) => {
				$wavesurfer.addMarker(m);
			});
		}
	});
	onMount(() => {
		ws = WaveSurfer.create({
			container: '#waveform',
			waveColor: 'violet',
			progressColor: 'purple',
			autoCenter: true,
			backend: 'WebAudio',
			// bargap: 1,
			// barWidth: 3,
			normalize: peaks ? false : true,
			height: 80,
			partialRender: true,
			responsive: true,
			scrollParent: true,
			closeAudioContext: false,
			fillParent: true,
			forceDecode: false,
			loopSelection: true,
			hideScrollbar: false,
			maxCanvasWidth: 4000,
			pixelRatio: 1,
			removeMediaElementOnDestroy: true,
			plugins: [
				// Media Session Plugin for (mobile) media notifications
				/* MediasessionPlugin.create({
					metadata: {
						title: 'tekstiks.ee'
					}
				}), */
				MinimapPlugin.create({
					// container: '#wave-minimap',
					waveColor: '#777',
					progressColor: '#222',
					height: 20
				}),
				RegionsPlugin.create({
					regions
				}),
				TimelinePlugin.create({
					container: '#wave-timeline'
				}),
				/* PlayheadPlugin.create({
					returnOnPause: false,
					moveOnSeek: true,
					draw: false
				}), */
				/* CursorPlugin.create({
					showTime: true,
					opacity: 1,
					customShowTimeStyle: {
						'background-color': '#000',
						color: '#fff',
						padding: '2px',
						'font-size': '10px'
					}
				}), */
				// Initialize based on speakers
				// Update based on store. Corresponds to editor blocks.
				MarkersPlugin.create({
					markers
				})
			]
		});
		if (peaks) {
			const peaksObj = JSON.parse(peaks);
			ws.load(url, peaksObj.data);
			console.log('peaks exist');
		} else ws.load(url);
		ws.play();
		wavesurfer.set(ws);

		$wavesurfer.on('region-in', function (region) {
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
		$wavesurfer.on('region-out', function (region) {
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
			wavesurferReady = true;
			duration.set($wavesurfer.getDuration());
			$wavesurfer.pause();
			player.update((x) => {
				return { ...x, ready: true };
			});
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
			wavesurferReady = false;
			player.set({ playing: false, muted: false, ready: false });
		});
	});

	// Local state
	let playbackSpeed = 0;
	let muted = false;
	let zoom = 50;

	// Local functions
	const setPlaybackSpeed = (speed: number) => (speed = playbackSpeed + speed);

	onDestroy(() => {
		if ($wavesurfer) {
			$wavesurfer.destroy();
		}
		wavesurfer.set(null);
		words.set([]);
		speakerNames.set([]);
		playingTime.set(0);
	});

	export const fasterSpeed = () => {
		if ($wavesurfer) {
			if (playbackSpeed <= 1.75) {
				$wavesurfer.setPlaybackRate(playbackSpeed + 0.25);
				setPlaybackSpeed(0.25);
			}
		}
	};
	export const slowerSpeed = () => {
		if ($wavesurfer) {
			if (playbackSpeed >= 0.5) {
				$wavesurfer.setPlaybackRate(playbackSpeed - 0.25);
				setPlaybackSpeed(-0.25);
			}
		}
	};
	export const normalSpeed = () => {
		if ($wavesurfer) {
			setPlaybackSpeed(1);
			$wavesurfer.setPlaybackRate(1);
		}
	};
	export const toggleRegions = () => {};
	export const seekTo = (pos) => {
		if ($wavesurfer && $wavesurfer.getDuration() >= pos) {
			$wavesurfer.setCurrentTime(pos);
		}
	};
	export const play = () => {
		$wavesurfer.play();
	};
	export const pause = () => {
		$wavesurfer.pause();
	};
	export const seekBackward = () => {
		$wavesurfer.skipBackward(5);
	};
	export const seekForward = () => {
		$wavesurfer.skipForward(5);
	};
	export const toggleMute = () => {
		$wavesurfer.toggleMute();
		muted = !muted;
	};
	export const togglePlay = () => {
		$wavesurfer.playPause();
		/* if (wavesurfer.isPlaying()) playing = true;
		else playing = false; */
	};
	export const zoomOut = () => {
		if (zoom > 5) zoom = zoom - 20;
		$wavesurfer.zoom(zoom);
	};
	export const zoomIn = () => {
		if (zoom < 205) zoom = zoom + 20;
		$wavesurfer.zoom(zoom);
	};
</script>

<div>
	<div id="waveform" class="" />
	<div id="wave-timeline" class="w-full h-auto" />
</div>

<style>
</style>
