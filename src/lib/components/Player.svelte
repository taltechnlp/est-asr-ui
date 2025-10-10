<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import Waveform from '$lib/components/Waveform.svelte'
    import Icon from 'svelte-awesome/components/Icon.svelte';
	import minus from 'svelte-awesome/icons/minusCircle';
	import plus from 'svelte-awesome/icons/plusCircle';
    import { player, waveform } from '$lib/stores.svelte';
    let { url } = $props();
    let rate = '1.0x';
	let zoom = $state(1);
    let rootEl: HTMLDivElement;

    // Publish --player-height based on rendered size
    let ro: ResizeObserver;
    onMount(() => {
      ro = new ResizeObserver(entries => {
        for (const e of entries) {
          const h = Math.ceil(e.contentRect.height);
          document.documentElement.style.setProperty('--player-height', h + 'px');
        }
      });
      if (rootEl) ro.observe(rootEl);
    });
    onDestroy(() => ro && ro.disconnect());

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
	const changePlaybackRate = (rate) => {
        const audio = document.getElementById("audio") as HTMLMediaElement;
		if (rate && rate >= 0.5 && rate <= 4){
			audio.playbackRate = rate;
		}
	}
    const changeSpeed= (el) => {
        const val = (el.srcElement.value.split('x')[0]);
        console.log(val);
        if (val) changePlaybackRate(val);
    }
</script>

<div class="w-full h-auto fixed bottom-0 left-0 pb-1 bg-white" bind:this={rootEl}>
    <div class="controls flex justify-between items-center pt-0.5 pb-0.5">
        <div class="flex justify-center items-center">
            <button class="btn btn-square btn-sm control-button ml-5" onclick={zoomIn}>
                <Icon data={plus} scale={1} />
            </button>
            <input type="range" min="0" max="3" bind:value={zoom} style="width: 100px; accent-color: var(--color-primary)" class="ml-1 hidden sm:block bg-base-100" onchange={zoomSlider}>
            <button class="btn btn-square btn-sm control-button ml-1" onclick={zoomOut}>
                <Icon data={minus} scale={1} />
            </button>
            <select class="select ml-2"
            bind:value={rate} onchange={changeSpeed}>
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
                <button class="btn btn-square control-button" onclick={seekBackward}>
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
                <button class="btn btn-square control-button" onclick={togglePlay} class:loading="{!$player.ready}">
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
                 <button class="btn btn-square control-button" onclick={seekForward}>
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
