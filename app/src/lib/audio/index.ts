/**
 * Audio utilities
 *
 * - webmToWav: Convert browser-recorded WebM/MP4 to WAV for STT
 * - sliceAndEncodeToWav: Extract time-windowed slice from recording (for karaoke)
 * - blobToBase64: Convert blob to base64 string
 */

export { webmToWav, sliceAndEncodeToWav, blobToBase64 } from './audio-converter'
