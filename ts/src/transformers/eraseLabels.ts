import type { CodeChunk } from "../compiler/chunks";

type ChunkInSymbol = string | symbol;
type ChunkIn = { label?: ChunkInSymbol; address?: ChunkInSymbol } & CodeChunk;

type ChunkOut = CodeChunk;

const isSymbol = (value: unknown): value is ChunkInSymbol => typeof value === "string" || typeof value === "symbol";

export const transform = (chunks: ChunkIn[]): ChunkOut[] => {
  type Handler = (address: number) => void;
  const labels = new Map<ChunkInSymbol, number>();
  const pendingLabels = new Map<ChunkInSymbol, Handler[]>();

  return chunks.map((chunk, i) => {
    const pc = i + 1;
    const { label, address, ...rest } = chunk;
    const newChunk: any = rest;

    if (label) {
      labels.set(label, i);
      if (pendingLabels.has(label)) {
        for (const pending of pendingLabels.get(label)!) {
          pending(i);
        }
        pendingLabels.delete(label);
      }
    }

    if (address && isSymbol(address)) {
      if (labels.has(address)) {
        newChunk.value = labels.get(address)! - pc;
      } else {
        const handler: Handler = (address) => {
          newChunk.value = address - pc;
        };
        const pendings = pendingLabels.get(address);
        if (pendings) pendings.push(handler);
        else pendingLabels.set(address, [handler]);
      }
    }

    return newChunk as ChunkOut;
  });
};
