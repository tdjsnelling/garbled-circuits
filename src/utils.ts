export function bufferToBigInt(buffer: Buffer): bigint {
  return BigInt("0x" + buffer.toString("hex"));
}

export function bigIntToBuffer(bigint: bigint): Buffer {
  return Buffer.from(bigint.toString(16), "hex");
}

export function getJwkInt(param: string): bigint {
  return bufferToBigInt(Buffer.from(param, "base64url"));
}
