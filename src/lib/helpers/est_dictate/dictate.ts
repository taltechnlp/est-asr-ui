/* export const dictate = (audioSourceId) => {
    type AudioConstraints = {
        audio?: boolean;
        sourceId?: string;
    }
    let audioSourceConstraints: AudioConstraints = {}; */

export const getMedia = async () => {
	const constraints = {
		audio: true,
		video: false
	};
	let stream = null;
	try {
		stream = await navigator.mediaDevices.getUserMedia(constraints);
		/* use the stream */
		console.log('stream created', stream);
	} catch (err) {
		/* handle the error */
		console.log('stream creation error', err);
	}
};

/* try {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        navigator.mediaDevices.getUserMedia = navigator.mediaDevices.getUserMedia || navigator.mediaDevices.webkitGetUserMedia || navigator.mediaDevices.mozGetUserMedia;
        window.URL = window.URL || window.webkitURL;
        const audioContext = new AudioContext();
        
        if (navigator.mediaDevices.getUserMedia){
            if(audioSourceId) {
                audioSourceConstraints.sourceId = audioSourceId;
            } else {
                    audioSourceConstraints.audio = true;
                }
                navigator.mediaDevices.getUserMedia(audioSourceConstraints).then(function(stream){
                    const input = audioContext.createMediaStreamSource(stream);
                    console.log('Media stream created');
                    //Firefox loses the audio input stream every five seconds
                    // To fix added the input to window.source
                    // window.source = input;
                    window.userSpeechAnalyser = audioContext.createAnalyser();
                    input.connect(window.userSpeechAnalyser);
                    
                });
            } else {
                console.log("No user media support");
            }
            
        } catch (e) {
            console.error("Error initializing Web Audio browser: " + e);
        } */
