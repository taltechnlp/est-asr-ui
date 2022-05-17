<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import WaveSurfer from 'wavesurfer.js';
	import TimelinePlugin from 'wavesurfer.js/dist/plugin/wavesurfer.timeline.min.js';
	import RegionsPlugin from 'wavesurfer.js/dist/plugin/wavesurfer.regions.min.js';
	export let url;
	import { player } from '$lib/stores';

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
					container: '#wave-timeline'
				})
			]
		});
		wavesurfer.on('ready', function () {
			// @ts-ignore
			window.myPlayer = wavesurfer;
			wavesurfer.play();
		});
		let skip = 0;
		wavesurfer.on('audioprocess', () => {
			highlightWord();
		});
		wavesurfer.on('mute', function () {
			player.update((x) => {
				return { ...x, muted: true };
			});
		});
		// console.log(url, "url")
		wavesurfer.load(url);
	});

	let playbackSpeed = 0;
	const setPlaybackSpeed = (speed: number) => (speed = playbackSpeed + speed);
	let playing = false;
	let muted = false;
	let zoom = 20;

	onDestroy(() => {
		if (wavesurfer) {
			wavesurfer.destroy();
		}
	});

	export const fasterSpeed = () => {
		if (wavesurfer) {
			if (playbackSpeed <= 1.75) {
				wavesurfer.setPlaybackRate(playbackSpeed + 0.25);
				setPlaybackSpeed(0.25);
			}
		}
	};
	export const slowerSpeed = () => {
		if (wavesurfer) {
			if (playbackSpeed >= 0.5) {
				wavesurfer.setPlaybackRate(playbackSpeed - 0.25);
				setPlaybackSpeed(-0.25);
			}
		}
	};
	export const normalSpeed = () => {
		if (wavesurfer) {
			setPlaybackSpeed(1);
			wavesurfer.setPlaybackRate(1);
		}
	};
	export const toggleRegions = () => {};
	export const seekTo = (pos) => {
		if (wavesurfer.getDuration() >= pos) {
			wavesurfer.setCurrentTime(pos);
		}
	};
	export const play = () => {
		wavesurfer.play();
		playing = true;
	};
	export const pause = () => {
		wavesurfer.pause();
		playing = false;
	};
	export const seekBackward = () => {
		wavesurfer.skipBackward(5);
	};
	export const seekForward = () => {
		wavesurfer.skipForward(5);
	};
	export const toggleMute = () => {
		wavesurfer.toggleMute();
		muted = !muted;
	};
	export const togglePlay = () => {
		wavesurfer.playPause();
		if (wavesurfer.isPlaying()) playing = true;
		else playing = false;
	};
	export const zoomOut = () => {
		if (zoom > 5) zoom = zoom - 20;
		wavesurfer.zoom(zoom);
	};
	export const zoomIn = () => {
		if (zoom < 205) zoom = zoom + 20;
		wavesurfer.zoom(zoom);
	};
	let lastProgress = 0;
	const highlightWord = () => {
		if (
			// @ts-ignore
			window.myEditor &&
			// @ts-ignore
			window.myEditorWords
		) {
			const progress = Math.round(wavesurfer.getCurrentTime() * 100);
			// Skip if it's the same exact time
			if (lastProgress !== progress) {
				// console.log(lastProgress, progress);
				lastProgress = progress;
				// @ts-ignore
				const node = window.myEditorWords.get(progress);
				if (node) {
					// @ts-ignore
					if (window.myEditor.lastHighlighted) {
						// @ts-ignore
						if (window.myEditor.lastHighlighted !== node) {
							// @ts-ignore
							window.myEditor.lastHighlighted.setAttribute('style', 'background-color: #FFF;');
							node.setAttribute('style', 'background-color: rgb(249, 204, 249);');
							// @ts-ignore
							window.myEditor.lastHighlighted = node;
						}
					} else {
						node.setAttribute('style', 'background-color: rgb(249, 204, 249);');
						// @ts-ignore
						window.myEditor.lastHighlighted = node;
					}
				}
			}
		}
	};
	/* wavesurfer.on("ready", function() {
      if (window.innerWidth < 450) {
        wavesurfer.setHeight(40);
      }
      wavesurfer.zoom(zoom);

      //console.log("Player ready");
      window.myWaveSurferPlayer = {};
      window.myWaveSurferPlayer.seekTo = seekTo;
      //console.log(window.myWaveSurferPlayer.seekTo);

      let isAlt = false;
      document.onkeyup = function(e) {
        if (e.which == 18) isAlt = false;
      };
      window.onkeydown = function(e) {
        switch (e.which) {
          case 18:
            isAlt = true;
            break;
          case 49:
            if (isAlt) seekBackward();
            break;
          case 50:
            if (isAlt) togglePlay();
            break;
          case 32:
            if (isAlt) togglePlay();
            break;
          case 51:
            if (isAlt) seekForward();
            break;
          case 77:
            if (isAlt) toggleMute();
            break;
        }
      };

      setIsReady(true);
    });

    wavesurfer.on("audioprocess", () =>
      highlightWord(wavesurfer)
    );
    wavesurfer.on("mute", function(value) {
      setMuted(value);
    });
    wavesurfer.on("region-in", function(value) {});

    return function cleanup() {
      wavesurfer.destroy();
    };
  }, []); */
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
