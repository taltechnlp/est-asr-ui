<script lang="ts">
	import WaveSurfer from 'wavesurfer.js';
	import { onMount, onDestroy } from 'svelte';
	import { beforeNavigate } from "$app/navigation";
	import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.min.js';
	import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.min.js';
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

	let ws: WaveSurfer;
	let wsRegions: RegionsPlugin;
	let wavesurferReady = false;
	const wordFilter = (w) => w && w.id && w.start && w.end;
	$: regions = $words.filter(wordFilter).map((word) => {
		return {
			id: word.id,
			start: word.start,
			end: word.end,
			drag: false,
			resize: false
		};
	});
	let names;
	const speakerFilter = (s) => s && s.start && s.start !== -1 && s.name;
	const unsubscribeSpeakerNames = speakerNames.subscribe((speakers) => {
		names = speakers
			.filter(speakerFilter)
			.sort((a, b) => (a.start > b.start ? 1 : -1))
			.map((speaker, i) => {
				return {
					start: speaker.start,
					content: speaker.name,
					color: '#FE621D',
				};
			});
		if (wsRegions && wsRegions.addRegion && wavesurferReady) {
			wsRegions.clearRegions();
			names.forEach((m) => {
				wsRegions.addRegion(m);
			});
			regions.forEach((r) => {
				wsRegions.addRegion(r);
			});
		}
	});
	onMount(() => {
		ws = WaveSurfer.create({
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
	let zoom = 50;

	// Local functions
	const setPlaybackSpeed = (speed: number) => (speed = playbackSpeed + speed);

	beforeNavigate( () => {
		// Removing this would cause a crash during away navigation
		unsubscribeSpeakerNames();
	}) 

	onDestroy(() => {
		unsubscribeSpeakerNames();
		if ($wavesurfer) {
			wsRegions.unAll();
			wsRegions.destroy();
			$wavesurfer.destroy();
		}
		wavesurfer.set(null);
		words.set([]);
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
