import { getRandomValues } from "crypto";

export function bufferToBigInt(buffer: Buffer): bigint {
  return BigInt("0x" + buffer.toString("hex"));
}

export function bigIntToBuffer(bigint: bigint): Buffer {
  return Buffer.from(bigint.toString(16), "hex");
}

export function getJwkInt(param: string): bigint {
  return bufferToBigInt(Buffer.from(param, "base64url"));
}

export function cartesianProduct(...a: unknown[][]): any[] {
  return a.reduce((a, b) => a.flatMap((d) => b.map((e) => [d, e].flat())));
}

export function secureShuffle(array: unknown[]) {
  for (let i = array.length - 1; i > 0; i--) {
    const buf = new Uint8Array(1);
    getRandomValues(buf);
    const j = Math.floor((buf[0] / 2 ** 8) * i);
    const temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
}
