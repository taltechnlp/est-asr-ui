<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import WaveSurfer from "wavesurfer.js";
	import TimelinePlugin from "wavesurfer.js/dist/plugin/wavesurfer.timeline.min.js";
	import RegionsPlugin from "wavesurfer.js/dist/plugin/wavesurfer.regions.min.js";

	let wavesurfer;
	onMount(() => {
		wavesurfer = WaveSurfer.create({
			container: '#waveform',
			waveColor: 'violet',
			progressColor: 'purple',
			autoCenter: true,
			// bargap: 1,
			// barWidth: 3, 
			normalize: true,
			height: 80,
			//partialRender: true,
			responsive: true,
			scrollParent: true,
			closeAudioContext: false,
			loopSelection: true,
			hideScrollbar: false,
			maxCanvasWidth: 4000,
			pixelRatio: 1,
			//forceDecode: true,
			
			plugins: [
				RegionsPlugin.create({
					regions: []
				}),
				TimelinePlugin.create({
					container: "#wave-timeline"
				})
			] 
		});
		wavesurfer.on('ready', function () {
			wavesurfer.play();
		});
		wavesurfer.load('../../../static/demo.wav');

	
	}); 

	let playbackSpeed = 0;
	const setPlaybackSpeed = (speed: number) => speed = playbackSpeed + speed
	let playing = false
	let zoom = 20;


	onDestroy(() => {
		if (wavesurfer) {
			wavesurfer.destroy();
		}
	});

	const fasterSpeed = () => {
		if (wavesurfer.current) {
		if (playbackSpeed <= 1.75) {
			wavesurfer.current.setPlaybackRate(playbackSpeed + 0.25);
			setPlaybackSpeed(0.25);
		}
		}
	};
	const slowerSpeed = () => {
		if (wavesurfer.current) {
		if (playbackSpeed >= 0.5) {
			wavesurfer.current.setPlaybackRate(playbackSpeed - 0.25);
			setPlaybackSpeed(-0.25);
		}
		}
	};
	const normalSpeed = () => {
		if (wavesurfer.current) {
			setPlaybackSpeed(1);
		wavesurfer.current.setPlaybackRate(1);
		}
	};
	const toggleRegions = () => {
	};
	const seekTo = pos => {
		if (wavesurfer.current.getDuration() >= pos) {
		wavesurfer.current.setCurrentTime(pos);
		}
	};
	const play = () => {
		wavesurfer.current.play();
		playing = true;
	};
	const pause = () => {
		wavesurfer.current.pause();
		playing = false;
	};
	const seekBackward = () => {
		wavesurfer.current.skipBackward(5);
	};
	const seekForward = () => {
		wavesurfer.current.skipForward(5);
	};
	const toggleMute = () => {
		wavesurfer.current.toggleMute();
	};
	const togglePlay = () => {
		wavesurfer.current.playPause();
		if (wavesurfer.current.isPlaying()) playing = true;
		else playing = false;
	};
	const zoomOut = () => {
		if (zoom > 5) (zoom = zoom - 20);
		wavesurfer.current.zoom(zoom);
	};
	const zoomIn = () => {
		if (zoom < 205) (zoom = zoom + 20);
		wavesurfer.current.zoom(zoom);
	};
</script>



<style>
	button.active {
		background: black;
		color: white;
	}
	.wavesurfer-region {
        border-color: #b2b0b6;
        border-style: solid;
        border-width: 0 1px 0;
        opacity: 0.3;
    }
</style>
