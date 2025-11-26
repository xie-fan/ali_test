/**
 * PCM Audio Processing Utilities
 * Handles conversion of audio data to PCM format suitable for Qwen API
 */

/**
 * Convert Float32Array to 16-bit PCM data
 * @param {Float32Array} float32Data - Audio data in float32 format
 * @returns {Int16Array} Audio data as 16-bit signed integers
 */
export function float32ToPcm16(float32Data) {
  const pcm16Data = new Int16Array(float32Data.length)
  for (let i = 0; i < float32Data.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Data[i]))
    pcm16Data[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return pcm16Data
}

/**
 * Convert Float32Array to 16-bit PCM and then to base64
 * @param {Float32Array} float32Data - Audio data in float32 format
 * @returns {string} Base64-encoded PCM data
 */
export function float32ToPcm16Base64(float32Data) {
  const pcm16 = float32ToPcm16(float32Data)
  const pcmBytes = new Uint8Array(pcm16.buffer, pcm16.byteOffset, pcm16.byteLength)
  return uint8ArrayToBase64(pcmBytes)
}

/**
 * Convert Uint8Array to base64 string
 * @param {Uint8Array} uint8Array - Byte array to convert
 * @returns {string} Base64-encoded string
 */
export function uint8ArrayToBase64(uint8Array) {
  let binary = ''
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i])
  }
  return btoa(binary)
}

/**
 * Resample audio data from one sample rate to another
 * Uses linear interpolation for resampling
 * @param {Float32Array} audioData - Original audio data
 * @param {number} sourceSampleRate - Original sample rate in Hz
 * @param {number} targetSampleRate - Target sample rate in Hz
 * @returns {Float32Array} Resampled audio data
 */
export function resampleAudio(audioData, sourceSampleRate, targetSampleRate) {
  if (sourceSampleRate === targetSampleRate) {
    return audioData
  }

  const ratio = targetSampleRate / sourceSampleRate
  const newLength = Math.ceil(audioData.length * ratio)
  const resampled = new Float32Array(newLength)

  for (let i = 0; i < newLength; i++) {
    const srcPosition = i / ratio
    const srcFloor = Math.floor(srcPosition)
    const srcCeil = Math.ceil(srcPosition)
    const fraction = srcPosition - srcFloor

    if (srcCeil >= audioData.length) {
      resampled[i] = audioData[audioData.length - 1]
    } else {
      const val1 = audioData[srcFloor] || 0
      const val2 = audioData[srcCeil] || 0
      resampled[i] = val1 * (1 - fraction) + val2 * fraction
    }
  }

  return resampled
}

/**
 * Convert stereo audio to mono by averaging channels
 * @param {Float32Array} left - Left channel audio data
 * @param {Float32Array} right - Right channel audio data (optional)
 * @returns {Float32Array} Mono audio data
 */
export function stereoToMono(left, right) {
  if (!right) {
    return left
  }

  const mono = new Float32Array(left.length)
  for (let i = 0; i < left.length; i++) {
    mono[i] = (left[i] + right[i]) / 2
  }
  return mono
}

/**
 * Process audio buffer from ScriptProcessor or AudioWorklet
 * Converts to 16-bit PCM mono at 16kHz and returns base64-encoded chunk
 * @param {Float32Array} audioBuffer - Raw audio buffer
 * @param {number} currentSampleRate - Current sample rate of the buffer
 * @param {number} targetSampleRate - Target sample rate (default: 16000)
 * @returns {string} Base64-encoded PCM data
 */
export function processAudioChunk(audioBuffer, currentSampleRate, targetSampleRate = 16000) {
  let processed = audioBuffer
  
  // Resample if necessary
  if (currentSampleRate !== targetSampleRate) {
    processed = resampleAudio(processed, currentSampleRate, targetSampleRate)
  }
  
  // Convert to base64-encoded PCM16
  return float32ToPcm16Base64(processed)
}
