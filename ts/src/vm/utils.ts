export function signExtend(x: number, bitCount: number) {
  const m = 1 << (bitCount - 1);
  x &= (1 << bitCount) - 1;
  return (x ^ m) - m;
}

export function putBuf(data: number[]) {
  process.stdout.write(Buffer.from(data).toString("utf8"));
}
