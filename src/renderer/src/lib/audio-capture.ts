export class AudioCapture {
  private stream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private processor: ScriptProcessorNode | null = null
  private source: MediaStreamAudioSourceNode | null = null

  private isCapturing = false
  private inSpeech = false
  private silenceMs = 0
  private utteranceMs = 0
  private buffer: Float32Array[] = []

  private readonly TARGET_SAMPLE_RATE = 16000
  private readonly BLOCK_SIZE = 4096
  private readonly SILENCE_THRESHOLD = 0.012
  private readonly END_SILENCE_MS = 900
  private readonly MIN_UTTERANCE_MS = 600
  private readonly MAX_UTTERANCE_MS = 9000

  onUtterance: ((audio: Float32Array) => void) | null = null

  async start(deviceId?: string): Promise<void> {
    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        ...(deviceId ? { deviceId: { exact: deviceId } } : {})
      }
    }

    this.stream = await navigator.mediaDevices.getUserMedia(constraints)

    this.audioContext = new AudioContext({ sampleRate: this.TARGET_SAMPLE_RATE })

    if (this.audioContext.sampleRate !== this.TARGET_SAMPLE_RATE) {
      console.warn(
        `AudioContext sample rate is ${this.audioContext.sampleRate}, expected ${this.TARGET_SAMPLE_RATE}. Audio will still work.`
      )
    }

    this.source = this.audioContext.createMediaStreamSource(this.stream)
    this.processor = this.audioContext.createScriptProcessor(this.BLOCK_SIZE, 1, 1)

    this.processor.onaudioprocess = (e) => {
      if (!this.isCapturing) return
      const data = e.inputBuffer.getChannelData(0)
      this.processBlock(new Float32Array(data))
    }

    this.source.connect(this.processor)
    this.processor.connect(this.audioContext.destination)
    this.isCapturing = true
  }

  stop(): void {
    this.isCapturing = false
    this.processor?.disconnect()
    this.source?.disconnect()
    this.audioContext?.close()
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    this.audioContext = null
    this.processor = null
    this.source = null
  }

  private rms(buf: Float32Array): number {
    let sum = 0
    for (let i = 0; i < buf.length; i++) {
      sum += buf[i] * buf[i]
    }
    return Math.sqrt(sum / buf.length) + 1e-12
  }

  private processBlock(data: Float32Array): void {
    const actualRate = this.audioContext?.sampleRate ?? this.TARGET_SAMPLE_RATE
    const blockMs = (data.length / actualRate) * 1000
    const level = this.rms(data)

    if (level >= this.SILENCE_THRESHOLD) {
      if (!this.inSpeech) {
        this.inSpeech = true
        this.silenceMs = 0
        this.utteranceMs = 0
        this.buffer = []
      }
      this.buffer.push(data)
      this.utteranceMs += blockMs
      this.silenceMs = 0
    } else {
      if (this.inSpeech) {
        this.buffer.push(data)
        this.utteranceMs += blockMs
        this.silenceMs += blockMs
      }
    }

    if (this.inSpeech && this.utteranceMs >= this.MAX_UTTERANCE_MS) {
      this.silenceMs = this.END_SILENCE_MS
    }

    if (this.inSpeech && this.silenceMs >= this.END_SILENCE_MS) {
      this.inSpeech = false

      if (this.utteranceMs < this.MIN_UTTERANCE_MS) {
        this.buffer = []
        return
      }

      const totalLength = this.buffer.reduce((acc, b) => acc + b.length, 0)
      const audio = new Float32Array(totalLength)
      let offset = 0
      for (const b of this.buffer) {
        audio.set(b, offset)
        offset += b.length
      }
      this.buffer = []

      const actualSampleRate = this.audioContext?.sampleRate ?? this.TARGET_SAMPLE_RATE
      if (actualSampleRate !== this.TARGET_SAMPLE_RATE) {
        this.onUtterance?.(resample(audio, actualSampleRate, this.TARGET_SAMPLE_RATE))
      } else {
        this.onUtterance?.(audio)
      }
    }
  }
}

function resample(audio: Float32Array, fromRate: number, toRate: number): Float32Array {
  const ratio = fromRate / toRate
  const newLength = Math.round(audio.length / ratio)
  const result = new Float32Array(newLength)
  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio
    const low = Math.floor(srcIndex)
    const high = Math.min(low + 1, audio.length - 1)
    const frac = srcIndex - low
    result[i] = audio[low] * (1 - frac) + audio[high] * frac
  }
  return result
}

export interface AudioDevice {
  deviceId: string
  label: string
}

export async function getAudioInputDevices(): Promise<AudioDevice[]> {
  try {
    await navigator.mediaDevices.getUserMedia({ audio: true })
  } catch {
    // Permission denied or no devices -- fall through to enumerate
  }

  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices
    .filter((d) => d.kind === 'audioinput')
    .map((d) => ({
      deviceId: d.deviceId,
      label: d.label || `Microphone (${d.deviceId.slice(0, 8)}...)`
    }))
}
