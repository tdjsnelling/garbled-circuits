import { randomBytes } from "crypto";
import { bufferToBigInt, bigIntToBuffer } from "./utils";

function mod(n: bigint, m: bigint): bigint {
  return ((n % m) + m) % m;
}

/*
  Fast modular exponentiation for a ^ b mod n
  https://gist.github.com/krzkaczor/0bdba0ee9555659ae5fe
*/
function modpow(a: bigint, b: bigint, n: bigint) {
  a = mod(a, n);
  let result = BigInt(1);
  let x = a;

  while (b > 0) {
    const leastSignificantBit = mod(b, BigInt(2));
    b = b / BigInt(2);

    if (leastSignificantBit == BigInt(1)) {
      result = result * x;
      result = mod(result, n);
    }

    x = x * x;
    x = mod(x, n);
  }
  return result;
}

// https://en.wikipedia.org/wiki/Oblivious_transfer#1%E2%80%932_oblivious_transfer

export function otSend1(nbits: number = 2048) {
  const x0 = bufferToBigInt(randomBytes(nbits / 8));
  const x1 = bufferToBigInt(randomBytes(nbits / 8));

  return { x0, x1 };
}

export function otSend2(
  d: bigint,
  N: bigint,
  x0: bigint,
  x1: bigint,
  v: bigint,
  m0: Buffer,
  m1: Buffer,
) {
  const k0 = modpow(v - x0, d, N);
  const k1 = modpow(v - x1, d, N);

  const m0k = mod(bufferToBigInt(m0) + k0, N);
  const m1k = mod(bufferToBigInt(m1) + k1, N);

  return { m0k, m1k };
}

export function otRecv1(
  b: 0 | 1,
  e: bigint,
  N: bigint,
  x0: bigint,
  x1: bigint,
  nbits: number = 2048,
) {
  const k = bufferToBigInt(randomBytes(nbits / 8));
  const xb = [x0, x1][b];

  const v = mod(xb + k ** e, N);

  return { v, k };
}

export function otRecv2(
  b: 0 | 1,
  N: bigint,
  k: bigint,
  m0k: bigint,
  m1k: bigint,
): Buffer {
  const mb = [m0k, m1k][b];
  return bigIntToBuffer(mod(mb - k, N));
}
