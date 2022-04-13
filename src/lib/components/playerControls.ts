/* export const fasterSpeed = () => {
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
}; */
// export const toggleRegions = () => {};
export const seekTo = (pos) => {
	if (wavesurfer && wavesurfer.getDuration() >= pos) {
		wavesurfer.setCurrentTime(pos);
	}
};
/* export const play = () => {
	wavesurfer.play();
	playing = true;
};
export const pause = () => {
	wavesurfer.pause();
	playing = false;
}; */
export const seekBackward = () => {
	wavesurfer.skipBackward(5);
};
export const seekForward = () => {
	wavesurfer.skipForward(5);
};
export const toggleMute = () => {
	wavesurfer.toggleMute();
};
export const togglePlay = () => {
	wavesurfer.playPause();
	if (wavesurfer.isPlaying()) playing = true;
	else playing = false;
};
/* export const zoomOut = () => {
	if (zoom > 5) zoom = zoom - 20;
	wavesurfer.zoom(zoom);
};
export const zoomIn = () => {
	if (zoom < 205) zoom = zoom + 20;
	wavesurfer.zoom(zoom);
}; */
