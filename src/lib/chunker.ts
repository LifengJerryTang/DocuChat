/**
 * Splits text into word-based chunks.
 */
export function splitIntoChunks(
  text: string,
  maxWordsPerChunk = 500
): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];

  for (let i = 0; i < words.length; i += maxWordsPerChunk) {
    const chunk = words.slice(i, i + maxWordsPerChunk).join(' ');
    if (chunk.trim()) chunks.push(chunk);
  }

  // Always return at least one chunk
  return chunks.length > 0 ? chunks : [text];
}

/**
 * Rough token estimate: 1 token ≈ 0.75 words (OpenAI rule of thumb).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.split(/\s+/).length * 1.33);
}
