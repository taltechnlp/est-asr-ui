<script>
    import Waveform from '$lib/components/Waveform.svelte'
    import Icon from 'svelte-awesome/components/Icon.svelte';
	import minus from 'svelte-awesome/icons/minus-circle';
	import plus from 'svelte-awesome/icons/plus-circle';
    import { player, waveform } from '$lib/stores';
    export let url;
    let rate = '1.0x';
	let zoom = 1;
	const togglePlay = () => {
		if ($waveform) {
            if ($player && $player.playing) $waveform.player.pause();
            else if ($player && !$player.playing) $waveform.player.play();
		}
	};
	const seekBackward = () => {
		if ($waveform) {
			$waveform.player.seek($waveform.player.getCurrentTime() - 1)
		}
	};
	const seekForward = () => {
		if ($waveform) {
			$waveform.player.seek($waveform.player.getCurrentTime() + 1)
		}
	};
	const zoomOut = () => {
		if ($waveform) {
            if (zoom < 3) zoom = zoom + 1;
            $waveform.zoom.setZoom(zoom);
		}
	};
	export const zoomIn = () => {
        if ($waveform) {
            if (zoom > 0) zoom = zoom - 1;
			$waveform.zoom.setZoom(zoom);
		}
	};
    export const zoomSlider = (el) => {
		if ($waveform) {
			$waveform.zoom.setZoom(el.srcElement.value);
		}
	};
</script>

<div class="w-full h-auto fixed bottom-0 left-0 pb-1 bg-white">
    <div class="controls flex justify-between items-center pt-0.5 pb-0.5">
        <div class="flex justify-center items-center">
            <button class="btn btn-square btn-sm control-button ml-5" on:click={zoomIn}>
                <Icon data={plus} scale={1} />
            </button>
            <input type="range" min="0" max="3" bind:value={zoom} style="width: 100px" class="ml-1 hidden sm:block" on:change={zoomSlider}>
            <button class="btn btn-square btn-sm control-button ml-1" on:click={zoomOut}>
                <Icon data={minus} scale={1} />
            </button>
        </div>
        <div class="flex justify-around items-center w-48 min-w-max">
            <div class="tooltip" data-tip="Shift + Tab">
                <button class="btn btn-square control-button" on:click={seekBackward}>
                    <svg
                        viewBox="0 0 24 24"
                        class="h-6 w-6 border-0"
                        fill="rgba(0, 0, 0, 0.54)"
                        stroke="currentColor"
                        ><path
                            d="M15,6.485V.137L1.285,9.23l-.029.02a3,3,0,0,0,0,4.883L15,23.943V17.515l9,6.428V.057Z"
                        /></svg
                    >
                </button>
            </div>
            <div class="tooltip" data-tip="Tab">
                <button class="btn btn-square control-button" on:click={togglePlay} class:loading="{!$player.ready}">
                    {#if $player.ready && !$player.playing}
                        <svg
                            viewBox="0 0 24 24"
                            class="h-6 w-6"
                            fill="rgba(0, 0, 0, 0.54)"
                            stroke="currentColor"
                            ><path
                                d="M20.492,7.969,10.954.975A5,5,0,0,0,3,5.005V19a4.994,4.994,0,0,0,7.954,4.03l9.538-6.994a5,5,0,0,0,0-8.062Z"
                            /></svg
                        >
                    {:else if $player.ready}
                        <svg
                            viewBox="0 0 24 24"
                            class="h-6 w-6"
                            fill="rgba(0, 0, 0, 0.54)"
                            stroke="currentColor"
                            ><path
                                d="M6.5,0A3.5,3.5,0,0,0,3,3.5v17a3.5,3.5,0,0,0,7,0V3.5A3.5,3.5,0,0,0,6.5,0Z"
                            /><path
                                d="M17.5,0A3.5,3.5,0,0,0,14,3.5v17a3.5,3.5,0,0,0,7,0V3.5A3.5,3.5,0,0,0,17.5,0Z"
                            /></svg
                        >
                    {/if}
                </button>
            </div>
             <div class="tooltip" data-tip="Alt + Tab">
                 <button class="btn btn-square control-button" on:click={seekForward}>
                    <svg viewBox="0 0 24 24" class="h-6 w-6" fill="rgba(0, 0, 0, 0.54)" stroke="currentColor"
                    ><path
                    d="M22.74,9.25,9,.137V6.485L0,.057V23.943l9-6.428v6.428l13.741-9.811a3,3,0,0,0,0-4.882Z"
                    /></svg
                    >
                </button>
            </div>
        </div>
        <div class="flex justify-center items-center">
            
        </div>
    </div>
    <Waveform
        url={url}
    />
</div>

<style>
	.controls {
		border-top: 2px solid rgba(23, 42, 58, 0.1);
	}
	.control-button {
		color: rgba(0, 0, 0, 0.54);
		background-color: white;
		background-image: linear-gradient(rgb(255, 255, 255), rgb(244, 245, 247));
	}
	.control-button:hover {
		background-image: linear-gradient(rgb(250, 251, 251), rgb(234, 236, 238));
	}
</style>