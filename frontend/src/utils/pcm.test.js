import { describe, it, expect } from 'vitest'
import {
  float32ToPcm16,
  float32ToPcm16Base64,
  uint8ArrayToBase64,
  resampleAudio,
  stereoToMono,
  processAudioChunk
} from './pcm.js'

describe('PCM Audio Processing Utilities', () => {
  describe('float32ToPcm16', () => {
    it('should convert positive float32 values to PCM16', () => {
      const float32 = new Float32Array([0.5, 0.75, 1.0])
      const pcm16 = float32ToPcm16(float32)

      expect(pcm16).toBeInstanceOf(Int16Array)
      expect(pcm16.length).toBe(3)
      expect(pcm16[0]).toBe(0.5 * 0x7fff)
      expect(pcm16[1]).toBe(0.75 * 0x7fff)
      expect(pcm16[2]).toBe(0x7fff)
    })

    it('should convert negative float32 values to PCM16', () => {
      const float32 = new Float32Array([-0.5, -0.75, -1.0])
      const pcm16 = float32ToPcm16(float32)

      expect(pcm16[0]).toBe(-0.5 * 0x8000)
      expect(pcm16[1]).toBe(-0.75 * 0x8000)
      expect(pcm16[2]).toBe(-0x8000)
    })

    it('should clamp values outside [-1, 1] range', () => {
      const float32 = new Float32Array([2.0, -2.0, 0.0])
      const pcm16 = float32ToPcm16(float32)

      expect(pcm16[0]).toBe(0x7fff) // clamped to 1.0
      expect(pcm16[1]).toBe(-0x8000) // clamped to -1.0
      expect(pcm16[2]).toBe(0)
    })

    it('should handle zero values', () => {
      const float32 = new Float32Array([0.0, 0.0, 0.0])
      const pcm16 = float32ToPcm16(float32)

      expect(pcm16[0]).toBe(0)
      expect(pcm16[1]).toBe(0)
      expect(pcm16[2]).toBe(0)
    })

    it('should handle empty array', () => {
      const float32 = new Float32Array([])
      const pcm16 = float32ToPcm16(float32)

      expect(pcm16.length).toBe(0)
    })
  })

  describe('uint8ArrayToBase64', () => {
    it('should convert uint8 array to base64', () => {
      const uint8 = new Uint8Array([72, 101, 108, 108, 111]) // "Hello"
      const base64 = uint8ArrayToBase64(uint8)

      expect(base64).toBe('SGVsbG8=')
    })

    it('should handle empty array', () => {
      const uint8 = new Uint8Array([])
      const base64 = uint8ArrayToBase64(uint8)

      expect(base64).toBe('')
    })

    it('should handle binary data', () => {
      const uint8 = new Uint8Array([0, 1, 2, 255, 254])
      const base64 = uint8ArrayToBase64(uint8)

      expect(typeof base64).toBe('string')
      expect(base64.length).toBeGreaterThan(0)
    })
  })

  describe('float32ToPcm16Base64', () => {
    it('should convert float32 to PCM16 base64', () => {
      const float32 = new Float32Array([0.5, -0.5, 0.0])
      const base64 = float32ToPcm16Base64(float32)

      expect(typeof base64).toBe('string')
      expect(base64.length).toBeGreaterThan(0)
    })

    it('should produce consistent results', () => {
      const float32 = new Float32Array([0.25, 0.5, 0.75])
      const base64_1 = float32ToPcm16Base64(float32)
      const base64_2 = float32ToPcm16Base64(float32)

      expect(base64_1).toBe(base64_2)
    })
  })

  describe('resampleAudio', () => {
    it('should return original data when rates are the same', () => {
      const original = new Float32Array([0.1, 0.2, 0.3, 0.4])
      const resampled = resampleAudio(original, 16000, 16000)

      expect(resampled).toBe(original)
    })

    it('should downsample audio correctly', () => {
      const original = new Float32Array([0.0, 0.5, 0.5, 0.0])
      const resampled = resampleAudio(original, 16000, 8000)

      expect(resampled.length).toBe(2)
    })

    it('should upsample audio correctly', () => {
      const original = new Float32Array([0.0, 0.5])
      const resampled = resampleAudio(original, 8000, 16000)

      expect(resampled.length).toBe(4)
    })

    it('should use linear interpolation for smooth resampling', () => {
      const original = new Float32Array([0.0, 1.0])
      const resampled = resampleAudio(original, 1, 5)

      expect(resampled.length).toBe(5)
      expect(resampled[0]).toBe(0.0)
      expect(resampled[4]).toBe(1.0)
      // Middle values should be between 0 and 1
      for (let i = 1; i < 4; i++) {
        expect(resampled[i]).toBeGreaterThan(0.0)
        expect(resampled[i]).toBeLessThan(1.0)
      }
    })

    it('should handle edge case with single sample', () => {
      const original = new Float32Array([0.5])
      const resampled = resampleAudio(original, 16000, 8000)

      expect(resampled.length).toBeGreaterThanOrEqual(0)
    })
  })

  describe('stereoToMono', () => {
    it('should convert stereo to mono by averaging channels', () => {
      const left = new Float32Array([0.4, 0.6])
      const right = new Float32Array([0.2, 0.4])
      const mono = stereoToMono(left, right)

      expect(mono.length).toBe(2)
      expect(mono[0]).toBe(0.3) // (0.4 + 0.2) / 2
      expect(mono[1]).toBe(0.5) // (0.6 + 0.4) / 2
    })

    it('should return left channel when right is undefined', () => {
      const left = new Float32Array([0.1, 0.2, 0.3])
      const mono = stereoToMono(left, undefined)

      expect(mono).toBe(left)
    })

    it('should handle zero values', () => {
      const left = new Float32Array([0.0, 0.5])
      const right = new Float32Array([0.0, 0.5])
      const mono = stereoToMono(left, right)

      expect(mono[0]).toBe(0.0)
      expect(mono[1]).toBe(0.5)
    })

    it('should handle opposite channels', () => {
      const left = new Float32Array([0.5, 0.5])
      const right = new Float32Array([-0.5, -0.5])
      const mono = stereoToMono(left, right)

      expect(mono[0]).toBe(0.0)
      expect(mono[1]).toBe(0.0)
    })
  })

  describe('processAudioChunk', () => {
    it('should process audio chunk with correct sample rate', () => {
      const audioBuffer = new Float32Array([0.1, 0.2, 0.3, 0.4])
      const base64 = processAudioChunk(audioBuffer, 16000, 16000)

      expect(typeof base64).toBe('string')
      expect(base64.length).toBeGreaterThan(0)
    })

    it('should resample when source rate differs from target', () => {
      const audioBuffer = new Float32Array([0.0, 0.5, 0.0])
      const base64 = processAudioChunk(audioBuffer, 48000, 16000)

      expect(typeof base64).toBe('string')
    })

    it('should use 16000 as default target sample rate', () => {
      const audioBuffer = new Float32Array([0.1, 0.2, 0.3])
      const base64_default = processAudioChunk(audioBuffer, 48000)
      const base64_explicit = processAudioChunk(audioBuffer, 48000, 16000)

      expect(base64_default).toBe(base64_explicit)
    })

    it('should produce consistent results for same input', () => {
      const audioBuffer = new Float32Array([0.2, 0.4, 0.6])
      const result1 = processAudioChunk(audioBuffer, 16000, 16000)
      const result2 = processAudioChunk(audioBuffer, 16000, 16000)

      expect(result1).toBe(result2)
    })
  })
})
