import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pluginPath = path.join(
  root,
  'node_modules/@capgo/capacitor-audio-recorder/android/src/main/java/app/capgo/audiorecorder/CapacitorAudioRecorderPlugin.java',
)

if (!fs.existsSync(pluginPath)) {
  console.warn('skip audio recorder patch: plugin not installed')
  process.exit(0)
}

let src = fs.readFileSync(pluginPath, 'utf8')

src = src.replace(
  `        int bitRate = call.getInt("bitRate", 192000);
        int sampleRate = call.getInt("sampleRate", 44100);

        try {
            prepareRecorder(bitRate, sampleRate);`,
  `        int bitRate = call.getInt("bitRate", 256000);
        int sampleRate = call.getInt("sampleRate", 48000);
        int numberOfChannels = call.getInt("numberOfChannels", 1);
        String audioSourceName = call.getString("audioSource", "VOICE_RECOGNITION");

        try {
            prepareRecorder(bitRate, sampleRate, numberOfChannels, audioSourceName);`,
)

const oldPrepare = `    private void prepareRecorder(int bitRate, int sampleRate) throws IOException {
        releaseRecorder();
        mediaRecorder = new MediaRecorder();
        mediaRecorder.setAudioSource(MediaRecorder.AudioSource.MIC);
        mediaRecorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
        mediaRecorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
        mediaRecorder.setAudioEncodingBitRate(bitRate);
        mediaRecorder.setAudioSamplingRate(sampleRate);`

const newPrepare = `    private int resolveAudioSource(String audioSourceName) {
        String name = audioSourceName == null ? "VOICE_RECOGNITION" : audioSourceName.toUpperCase(Locale.US);
        if ("UNPROCESSED".equals(name) && android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N) {
            return MediaRecorder.AudioSource.UNPROCESSED;
        }
        if ("MIC".equals(name)) {
            return MediaRecorder.AudioSource.MIC;
        }
        return MediaRecorder.AudioSource.VOICE_RECOGNITION;
    }

    private void prepareRecorder(int bitRate, int sampleRate, int numberOfChannels, String audioSourceName) throws IOException {
        releaseRecorder();
        mediaRecorder = new MediaRecorder();
        int audioSource = resolveAudioSource(audioSourceName);
        try {
            mediaRecorder.setAudioSource(audioSource);
        } catch (RuntimeException ex) {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N) {
                mediaRecorder.setAudioSource(MediaRecorder.AudioSource.UNPROCESSED);
            } else {
                mediaRecorder.setAudioSource(MediaRecorder.AudioSource.MIC);
            }
        }
        mediaRecorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
        mediaRecorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
        mediaRecorder.setAudioEncodingBitRate(bitRate);
        mediaRecorder.setAudioSamplingRate(sampleRate);
        mediaRecorder.setAudioChannels(Math.max(1, numberOfChannels));`

if (!src.includes('prepareRecorder(bitRate, sampleRate, numberOfChannels, audioSourceName)')) {
  console.error('audio recorder patch: startRecording signature not updated')
  process.exit(1)
}

if (src.includes(oldPrepare)) {
  src = src.replace(oldPrepare, newPrepare)
} else if (!src.includes('resolveAudioSource')) {
  console.error('audio recorder patch: prepareRecorder not found')
  process.exit(1)
}

fs.writeFileSync(pluginPath, src)
console.log('patched capacitor-audio-recorder for VOICE_RECOGNITION mono capture')
