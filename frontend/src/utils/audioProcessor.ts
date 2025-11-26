/**
 * Audio Processing Utilities
 * Handles decoding, resampling, chunking, and encoding audio files
 */

export interface AudioProcessingOptions {
  targetSampleRate?: number
  chunkSizeKB?: number
}

export interface ChunkedAudioData {
  chunks: string[]
  totalSize: number
  sampleRate: number
  duration: number
}

const DEFAULT_SAMPLE_RATE = 16000
const DEFAULT_CHUNK_SIZE_KB = 40

/**
 * Check if audio format is supported by the browser
 */
export function isSupportedAudioFormat(file: File): boolean {
  const supportedTypes = [
    'audio/wav',
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
    'audio/ogg',
    'audio/webm',
    'audio/flac',
  ]

  return supportedTypes.some(
    (type) => file.type === type || file.type.startsWith(type.split('/')[0])
  )
}

/**
 * Decode an audio file to AudioBuffer
 */
export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer()
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
    return audioBuffer
  } catch (error) {
    throw new Error(`Failed to decode audio: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Resample audio buffer to target sample rate
 */
export async function resampleAudio(
  audioBuffer: AudioBuffer,
  targetSampleRate: number = DEFAULT_SAMPLE_RATE
): Promise<AudioBuffer> {
  const sourceSampleRate = audioBuffer.sampleRate

  if (sourceSampleRate === targetSampleRate) {
    return audioBuffer
  }

  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
  const ratio = targetSampleRate / sourceSampleRate
  const newLength = Math.round(audioBuffer.length * ratio)

  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    newLength,
    targetSampleRate
  )

  const source = offlineContext.createBufferSource()
  source.buffer = audioBuffer
  source.connect(offlineContext.destination)
  source.start(0)

  try {
    const resampledBuffer = await offlineContext.startRendering()
    return resampledBuffer
  } catch (error) {
    throw new Error(
      `Failed to resample audio: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Convert AudioBuffer to PCM (Mono, 16-bit)
 */
export function audioBufferToPCM(audioBuffer: AudioBuffer): Uint8Array {
  const numberOfChannels = audioBuffer.numberOfChannels
  const sampleRate = audioBuffer.sampleRate
  const format = audioBuffer.getChannelData(0)
  const length = format.length

  // Create PCM data (16-bit mono)
  const pcm = new Int16Array(length)

  for (let i = 0; i < length; i++) {
    let sample = 0

    // Mix channels to mono
    for (let ch = 0; ch < numberOfChannels; ch++) {
      sample += audioBuffer.getChannelData(ch)[i]
    }
    sample /= numberOfChannels

    // Convert to 16-bit PCM
    sample = Math.max(-1, Math.min(1, sample))
    pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
  }

  return new Uint8Array(pcm.buffer)
}

/**
 * Chunk PCM data and base64 encode each chunk
 */
export function chunkAndEncodeAudio(
  pcmData: Uint8Array,
  chunkSizeKB: number = DEFAULT_CHUNK_SIZE_KB
): string[] {
  const chunkSize = chunkSizeKB * 1024
  const chunks: string[] = []

  for (let i = 0; i < pcmData.length; i += chunkSize) {
    const chunk = pcmData.slice(i, i + chunkSize)
    const base64Chunk = btoa(String.fromCharCode.apply(null, Array.from(chunk)))
    chunks.push(base64Chunk)
  }

  return chunks
}

/**
 * Process audio file completely: decode, resample, convert to PCM, chunk and encode
 */
export async function processAudioFile(
  file: File,
  options: AudioProcessingOptions = {}
): Promise<ChunkedAudioData> {
  const targetSampleRate = options.targetSampleRate || DEFAULT_SAMPLE_RATE
  const chunkSizeKB = options.chunkSizeKB || DEFAULT_CHUNK_SIZE_KB

  // Decode
  const audioBuffer = await decodeAudioFile(file)

  // Resample
  const resampledBuffer = await resampleAudio(audioBuffer, targetSampleRate)

  // Convert to PCM
  const pcmData = audioBufferToPCM(resampledBuffer)

  // Chunk and encode
  const chunks = chunkAndEncodeAudio(pcmData, chunkSizeKB)

  return {
    chunks,
    totalSize: pcmData.length,
    sampleRate: targetSampleRate,
    duration: resampledBuffer.duration,
  }
}

/**
 * Validate audio file size (max 100MB)
 */
export function validateAudioFileSize(file: File, maxSizeMB: number = 100): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024
  return file.size <= maxSizeBytes
}

/**
 * Format bytes to human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}
