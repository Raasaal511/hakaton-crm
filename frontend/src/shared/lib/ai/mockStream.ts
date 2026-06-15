/**
 * Simulates LLM streaming output with realistic per-character delays.
 * Used everywhere streaming text is displayed in the AI UI.
 */

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Yields characters one-by-one with realistic timing. */
export async function* streamText(text: string): AsyncGenerator<string> {
  for (const char of text) {
    yield char
    if (char === '\n') {
      await delay(60)
    } else if (/[.!?]/.test(char)) {
      await delay(110 + Math.random() * 60)
    } else if (/[,;:]/.test(char)) {
      await delay(50 + Math.random() * 30)
    } else {
      await delay(14 + Math.random() * 18)
    }
  }
}

/**
 * Consumes a streamText generator and calls onChunk for each character
 * and onDone when complete. Returns a cancel function.
 */
export function runStream(
  text: string,
  onChunk: (partial: string) => void,
  onDone?: () => void,
): () => void {
  let cancelled = false
  let accumulated = ''

  async function run() {
    for await (const char of streamText(text)) {
      if (cancelled) break
      accumulated += char
      onChunk(accumulated)
    }
    if (!cancelled) onDone?.()
  }

  run()
  return () => { cancelled = true }
}

/**
 * Hook-friendly wrapper: returns a ref to cancel the current stream.
 */
export function streamInto(
  text: string,
  setter: (v: string) => void,
  onDone?: () => void,
): () => void {
  return runStream(text, setter, onDone)
}
