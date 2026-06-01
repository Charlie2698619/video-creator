function writeWavHeader(buffer, dataSize, sampleRate) {
  const channels = 1
  const bitsPerSample = 16
  const bytesPerSample = bitsPerSample / 8
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(channels, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * channels * bytesPerSample, 28)
  buffer.writeUInt16LE(channels * bytesPerSample, 32)
  buffer.writeUInt16LE(bitsPerSample, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)
}

export function createSoftMusicBed({ durationSeconds, sampleRate = 44_100 }) {
  const sampleCount = Math.max(1, Math.ceil(durationSeconds * sampleRate))
  const dataSize = sampleCount * 2
  const buffer = Buffer.alloc(44 + dataSize)
  writeWavHeader(buffer, dataSize, sampleRate)

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate
    const remaining = durationSeconds - time
    const fade = Math.max(0, Math.min(1, time / 1.5, remaining / 1.5))
    const pulse = 0.74 + 0.26 * Math.sin(2 * Math.PI * 0.09 * time)
    const chord =
      Math.sin(2 * Math.PI * 220 * time) +
      0.7 * Math.sin(2 * Math.PI * 330 * time) +
      0.45 * Math.sin(2 * Math.PI * 440 * time)
    const sample = Math.max(-1, Math.min(1, chord * 0.035 * fade * pulse))
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + index * 2)
  }

  return buffer
}
