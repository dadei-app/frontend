export class RingBuffer {
  private readonly capacity: number;
  private readonly buffer: Int16Array;
  private writeIndex = 0;
  private size = 0;

  constructor(
    durationSeconds = 3,
    sampleRate = 16000,
  ) {
    this.capacity = Math.max(1, Math.floor(durationSeconds * sampleRate));
    this.buffer = new Int16Array(this.capacity);
  }

  push(samples: Int16Array): void {
    for (let i = 0; i < samples.length; i++) {
      this.buffer[this.writeIndex] = samples[i];
      this.writeIndex = (this.writeIndex + 1) % this.capacity;
      if (this.size < this.capacity) this.size += 1;
    }
  }

  drain(): Int16Array {
    if (this.size === 0) return new Int16Array(0);

    const out = new Int16Array(this.size);
    const start = (this.writeIndex - this.size + this.capacity) % this.capacity;
    for (let i = 0; i < this.size; i++) {
      out[i] = this.buffer[(start + i) % this.capacity];
    }

    this.size = 0;
    return out;
  }
}
