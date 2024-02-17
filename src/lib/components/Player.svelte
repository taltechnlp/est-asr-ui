<script>
    import Waveform from '$lib/components/Waveform.svelte'
    import Icon from 'svelte-awesome/components/Icon.svelte';
	import minus from 'svelte-awesome/icons/minus-circle';
	import plus from 'svelte-awesome/icons/plus-circle';
    import { player, wavesurfer } from '$lib/stores';
    export let url;
    let rate = '1.0x';
    let muted = false;
	let zoom = 50;
	const togglePlay = () => {
		if ($wavesurfer) {
			$wavesurfer.playPause();
		}
	};
	const seekBackward = () => {
		if ($wavesurfer) {
			$wavesurfer.setTime($wavesurfer.getCurrentTime() - 1)
		}
	};
	const seekForward = () => {
		if ($wavesurfer) {
			$wavesurfer.setTime($wavesurfer.getCurrentTime() + 1)
		}
	};
	const toggleMute = () => {
		if ($wavesurfer) {
			$wavesurfer.setMuted(!muted);
			muted = $wavesurfer.getMuted();
		}
	};
	const zoomOut = () => {
		if ($wavesurfer) {
			if (zoom > 5) zoom = zoom - 20;
			$wavesurfer.zoom(zoom);
		}
	};
	export const zoomIn = () => {
		if ($wavesurfer) {
			if (zoom < 205) zoom = zoom + 20;
			$wavesurfer.zoom(zoom);
		}
	};
    export const zoomSlider = (el) => {
		if ($wavesurfer) {
			$wavesurfer.zoom(el.srcElement.value);
		}
	};
    const changePlaybackRate = (el) => {
        const val = (el.srcElement.value.split('x')[0])
        if ($wavesurfer) {
			$wavesurfer.setPlaybackRate(val);
		}
    }
</script>

<div class="w-full h-auto fixed bottom-0 left-0 pb-1 bg-white">
    <div class="controls flex justify-between items-center pt-0.5 pb-0.5">
        <div class="flex justify-center items-center">
            <button class="btn btn-square btn-sm control-button ml-5" on:click={zoomOut}>
                <Icon data={minus} scale={1} />
            </button>
            <input type="range" min="0" max="200" bind:value={zoom} style="width: 100px" class="ml-1 hidden sm:block" on:change={zoomSlider}>
            <button class="btn btn-square btn-sm control-button ml-1" on:click={zoomIn}>
                <Icon data={plus} scale={1} />
            </button>
            <select class="select select-bordered ml-2"
            bind:value={rate} on:change={changePlaybackRate}>
                <option>0.5x</option>
                <option>0.6x</option>
                <option>0.7x</option>
                <option>0.8x</option>
                <option>0.9x</option>
                <option>1.0x</option>
                <option>1.1x</option>
                <option>1.2x</option>
                <option>1.3x</option>
                <option>1.4x</option>
                <option>1.5x</option>
                <option>1.6x</option>
                <option>1,7x</option>
                <option>1.8x</option>
                <option>1.9x</option>
                <option>2.0x</option>
            </select>
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
            <button class="btn btn-square btn-sm control-button mr-5" on:click={toggleMute}>
                {#if muted}
                    <svg
                        viewBox="0 0 24 24"
                        class="h-6 w-6"
                        fill="rgba(0, 0, 0, 0.54)"
                        stroke="currentColor"
                        ><path
                            d="M3,9H7L12,4V20L7,15H3V9M16.59,12L14,9.41L15.41,8L18,10.59L20.59,8L22,9.41L19.41,12L22,14.59L20.59,16L18,13.41L15.41,16L14,14.59L16.59,12Z"
                        /></svg
                    >
                {:else}
                    <svg
                        viewBox="0 0 24 24"
                        class="h-6 w-6"
                        fill="rgba(0, 0, 0, 0.54)"
                        stroke="currentColor"
                        ><path
                            d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.84 14,18.7V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z"
                        /></svg
                    >
                {/if}
            </button>
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