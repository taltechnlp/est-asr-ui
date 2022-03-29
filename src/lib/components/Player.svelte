<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import WaveSurfer from "wavesurfer.js";

	let wavesurfer;
	onMount(() => {
		wavesurfer = WaveSurfer.create({
			container: '#waveform',
			waveColor: 'violet',
			progressColor: 'purple'
		});
		wavesurfer.on('ready', function () {
			wavesurfer.play();
		});
		wavesurfer.load('../../../static/demo.wav');

	
	}); 

	onDestroy(() => {
		if (wavesurfer) {
			wavesurfer.destroy();
		}
	});
</script>

<style>
	button.active {
		background: black;
		color: white;
	}
</style>
