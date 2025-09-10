/*
I made this function for fun btw, i just wanted to test how far i could go, dont wonder why generating a fucking API key is so complicated.
It's probably overengineered as hell, but it generates pretty good random strings with a good distribution.

If you read this, support my broke ass on PayPal: https://www.paypal.me/cptcr
*/

export default function makeid(length = 64): string {
  class EntropyCollector {
    private entropy: number[] = [];
    private timeSeeds: number[] = [];
    private performanceMarks: number[] = [];
    collect() {
      const now = Date.now();
      const perf = typeof performance !== 'undefined' ? performance.now() : 0;
      this.timeSeeds.push(now & 0xFF, (now >> 8) & 0xFF, (now >> 16) & 0xFF);
      this.performanceMarks.push(Math.floor(perf * 1000) & 0xFF);
      const memUsage = typeof process !== 'undefined' && process.memoryUsage ? process.memoryUsage().heapUsed : Math.random() * 0xFFFFFF;
      this.entropy.push(memUsage & 0xFF, (memUsage >> 8) & 0xFF);
      for (let i = 0; i < 4; i++) {
        const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const dummy = Array(100).fill(0).map(() => Math.random());
        const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
        this.entropy.push(Math.floor((end - start) * 10000) & 0xFF);
      }
      return this;
    }
    getEntropy() {
      return [...this.entropy, ...this.timeSeeds, ...this.performanceMarks];
    }
    mix(data: number[]) {
      const mixed: number[] = [];
      for (let i = 0; i < data.length; i++) {
        const e = this.entropy[i % this.entropy.length] || 0;
        const t = this.timeSeeds[i % this.timeSeeds.length] || 0;
        const p = this.performanceMarks[i % this.performanceMarks.length] || 0;
        mixed.push(data[i] ^ e ^ t ^ p);
      }
      return mixed;
    }
  }
  class ChaoticGenerator {
    private state: number;
    private history: number[] = [];
    constructor(seed: number) {
      this.state = seed || Date.now();
    }
    logisticMap(x: number, r = 3.9999) {
      return r * x * (1 - x);
    }
    arnoldCat(x: number, y: number) {
      const newX = (2 * x + y) % 1;
      const newY = (x + y) % 1;
      return { x: newX, y: newY };
    }
    henon(x: number, y: number, a = 1.4, b = 0.3) {
      const newX = 1 - a * x * x + y;
      const newY = b * x;
      return { x: newX, y: newY };
    }
    generate() {
      let x = (this.state % 1000) / 1000;
      let y = ((this.state >> 10) % 1000) / 1000;
      for (let i = 0; i < 10; i++) {
        x = this.logisticMap(x);
      }
      const arnold = this.arnoldCat(x, y);
      const henon = this.henon(arnold.x, arnold.y);
      const result = Math.floor(Math.abs(henon.x * henon.y * 0xFFFFFF)) & 0xFF;
      this.history.push(result);
      this.state = (this.state * 1103515245 + 12345) & 0x7FFFFFFF;
      return result;
    }
    generateSequence(length: number) {
      const sequence: number[] = [];
      for (let i = 0; i < length; i++) {
        sequence.push(this.generate());
      }
      return sequence;
    }
  }
  class CryptoMixer {
    private boxes: Uint8Array[];
    private permutation: number[];
    constructor() {
      this.boxes = [];
      this.permutation = [];
      this.initialize();
    }
    initialize() {
      for (let i = 0; i < 4; i++) {
        const box = new Uint8Array(256);
        crypto.getRandomValues(box);
        this.boxes.push(box);
      }
      this.permutation = Array.from({ length: 256 }, (_, i) => i);
      for (let i = 255; i > 0; i--) {
        const j = Math.floor(crypto.getRandomValues(new Uint8Array(1))[0] / 256 * (i + 1));
        [this.permutation[i], this.permutation[j]] = [this.permutation[j], this.permutation[i]];
      }
    }
    substitute(value: number, round: number) {
      const box = this.boxes[round % this.boxes.length];
      return box[value & 0xFF];
    }
    permute(value: number) {
      return this.permutation[value & 0xFF];
    }
    feistel(left: number, right: number, key: number) {
      const f = (right ^ key) * 0x9E3779B9;
      return { left: right, right: left ^ (f & 0xFF) };
    }
    process(data: number[]) {
      const processed: number[] = [];
      for (let i = 0; i < data.length; i += 2) {
        let left = data[i] || 0;
        let right = data[i + 1] || 0;
        for (let round = 0; round < 4; round++) {
          left = this.substitute(left, round);
          right = this.permute(right);
          const result = this.feistel(left, right, this.boxes[round % this.boxes.length][0]);
          left = result.left;
          right = result.right;
        }
        processed.push(left, right);
      }
      return processed;
    }
  }
  class StreamCipher {
    private state: Uint32Array;
    private counter: number;
    constructor(key: Uint8Array) {
      this.state = new Uint32Array(16);
      this.counter = 0;
      this.initializeState(key);
    }
    initializeState(key: Uint8Array) {
      const expanded = new Uint8Array(64);
      for (let i = 0; i < 64; i++) {
        expanded[i] = key[i % key.length];
      }
      for (let i = 0; i < 16; i++) {
        this.state[i] = (expanded[i * 4] << 24) | (expanded[i * 4 + 1] << 16) | (expanded[i * 4 + 2] << 8) | expanded[i * 4 + 3];
      }
    }
    quarterRound(a: number, b: number, c: number, d: number) {
      this.state[a] = (this.state[a] + this.state[b]) >>> 0;
      this.state[d] = ((this.state[d] ^ this.state[a]) << 16) | ((this.state[d] ^ this.state[a]) >>> 16);
      this.state[c] = (this.state[c] + this.state[d]) >>> 0;
      this.state[b] = ((this.state[b] ^ this.state[c]) << 12) | ((this.state[b] ^ this.state[c]) >>> 20);
      this.state[a] = (this.state[a] + this.state[b]) >>> 0;
      this.state[d] = ((this.state[d] ^ this.state[a]) << 8) | ((this.state[d] ^ this.state[a]) >>> 24);
      this.state[c] = (this.state[c] + this.state[d]) >>> 0;
      this.state[b] = ((this.state[b] ^ this.state[c]) << 7) | ((this.state[b] ^ this.state[c]) >>> 25);
    }
    generateBlock() {
      const working = new Uint32Array(this.state);
      for (let i = 0; i < 10; i++) {
        this.quarterRound(0, 4, 8, 12);
        this.quarterRound(1, 5, 9, 13);
        this.quarterRound(2, 6, 10, 14);
        this.quarterRound(3, 7, 11, 15);
        this.quarterRound(0, 5, 10, 15);
        this.quarterRound(1, 6, 11, 12);
        this.quarterRound(2, 7, 8, 13);
        this.quarterRound(3, 4, 9, 14);
      }
      const output: number[] = [];
      for (let i = 0; i < 16; i++) {
        const val = (this.state[i] + working[i]) >>> 0;
        output.push(val & 0xFF, (val >>> 8) & 0xFF, (val >>> 16) & 0xFF, (val >>> 24) & 0xFF);
      }
      this.counter++;
      this.state[12] = (this.state[12] + 1) >>> 0;
      if (this.state[12] === 0) this.state[13] = (this.state[13] + 1) >>> 0;
      return output;
    }
    generate(length: number) {
      const output: number[] = [];
      while (output.length < length) {
        output.push(...this.generateBlock());
      }
      return output.slice(0, length);
    }
  }
  class HashFunction {
    private state: Uint32Array;
    constructor() {
      this.state = new Uint32Array([0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A, 0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19]);
    }
    rotateRight(n: number, b: number) {
      return (n >>> b) | (n << (32 - b));
    }
    ch(x: number, y: number, z: number) {
      return (x & y) ^ (~x & z);
    }
    maj(x: number, y: number, z: number) {
      return (x & y) ^ (x & z) ^ (y & z);
    }
    sigma0(x: number) {
      return this.rotateRight(x, 2) ^ this.rotateRight(x, 13) ^ this.rotateRight(x, 22);
    }
    sigma1(x: number) {
      return this.rotateRight(x, 6) ^ this.rotateRight(x, 11) ^ this.rotateRight(x, 25);
    }
    process(data: number[]) {
      const K = [0x428A2F98, 0x71374491, 0xB5C0FBCF, 0xE9B5DBA5, 0x3956C25B, 0x59F111F1, 0x923F82A4, 0xAB1C5ED5];
      const W = new Uint32Array(64);
      for (let i = 0; i < Math.min(16, data.length); i++) {
        W[i] = data[i] >>> 0;
      }
      for (let i = 16; i < 64; i++) {
        const s0 = this.rotateRight(W[i - 15], 7) ^ this.rotateRight(W[i - 15], 18) ^ (W[i - 15] >>> 3);
        const s1 = this.rotateRight(W[i - 2], 17) ^ this.rotateRight(W[i - 2], 19) ^ (W[i - 2] >>> 10);
        W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
      }
      let [a, b, c, d, e, f, g, h] = this.state;
      for (let i = 0; i < 64; i++) {
        const S1 = this.sigma1(e);
        const ch = this.ch(e, f, g);
        const temp1 = (h + S1 + ch + K[i % 8] + W[i]) >>> 0;
        const S0 = this.sigma0(a);
        const maj = this.maj(a, b, c);
        const temp2 = (S0 + maj) >>> 0;
        h = g;
        g = f;
        f = e;
        e = (d + temp1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) >>> 0;
      }
      this.state[0] = (this.state[0] + a) >>> 0;
      this.state[1] = (this.state[1] + b) >>> 0;
      this.state[2] = (this.state[2] + c) >>> 0;
      this.state[3] = (this.state[3] + d) >>> 0;
      this.state[4] = (this.state[4] + e) >>> 0;
      this.state[5] = (this.state[5] + f) >>> 0;
      this.state[6] = (this.state[6] + g) >>> 0;
      this.state[7] = (this.state[7] + h) >>> 0;
      const output: number[] = [];
      for (let i = 0; i < 8; i++) {
        output.push(this.state[i] & 0xFF, (this.state[i] >>> 8) & 0xFF, (this.state[i] >>> 16) & 0xFF, (this.state[i] >>> 24) & 0xFF);
      }
      return output;
    }
  }
  class WhiteningLayer {
    private masks: number[][];
    constructor() {
      this.masks = [];
      for (let i = 0; i < 8; i++) {
        const mask = new Uint8Array(32);
        crypto.getRandomValues(mask);
        this.masks.push(Array.from(mask));
      }
    }
    apply(data: number[], round: number) {
      const mask = this.masks[round % this.masks.length];
      return data.map((byte, i) => byte ^ mask[i % mask.length]);
    }
    diffuse(data: number[]) {
      const diffused: number[] = [];
      for (let i = 0; i < data.length; i++) {
        let value = data[i];
        if (i > 0) value ^= data[i - 1];
        if (i < data.length - 1) value ^= data[i + 1];
        diffused.push(value);
      }
      return diffused;
    }
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const entropy = new EntropyCollector().collect();
  const chaotic = new ChaoticGenerator(Date.now() ^ (Math.random() * 0xFFFFFF));
  const chaoticBytes = chaotic.generateSequence(length * 2);
  const mainKey = new Uint8Array(32);
  crypto.getRandomValues(mainKey);
  const cipher = new StreamCipher(mainKey);
  const streamBytes = cipher.generate(length * 2);
  const mixer = new CryptoMixer();
  const mixed1 = mixer.process(chaoticBytes);
  const mixed2 = mixer.process(streamBytes);
  const hasher = new HashFunction();
  const hashed1 = hasher.process(mixed1);
  const hashed2 = hasher.process(mixed2);
  const whitener = new WhiteningLayer();
  let combined: number[] = [];
  for (let i = 0; i < length; i++) {
    const idx1 = i % hashed1.length;
    const idx2 = i % hashed2.length;
    const idx3 = i % chaoticBytes.length;
    const idx4 = i % streamBytes.length;
    combined.push(hashed1[idx1] ^ hashed2[idx2] ^ chaoticBytes[idx3] ^ streamBytes[idx4]);
  }
  combined = entropy.mix(combined);
  for (let round = 0; round < 3; round++) {
    combined = whitener.apply(combined, round);
    combined = whitener.diffuse(combined);
  }
  const finalKey = combined.slice(0, length).map(byte => chars[byte % chars.length]).join('');
  return finalKey;
}


/*
If you want a more secure algo use this one instead bruh:
export default function makeid(length = 45): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => chars[b % chars.length]).join('');
}

(It is indeed a LOT more secure, but also way more boring and less fun to implement)
*/