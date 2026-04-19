/**
 * Model pricing configuration — USD per million tokens.
 */
export interface ModelPricing {
  input: number;  // USD per 1M input tokens
  output: number; // USD per 1M output tokens
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  "claude-sonnet-4": { input: 3, output: 15 },
  "claude-opus-4": { input: 15, output: 75 },
  "gpt-4o": { input: 2.5, output: 10 },
  "kimi-k2": { input: 1, output: 3 },
  "gemma-4": { input: 0, output: 0 }, // local model, no cost
};

/**
 * Calculate estimated cost in USD.
 * Returns 0 for unknown models.
 */
export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;
  return (promptTokens * pricing.input + completionTokens * pricing.output) / 1_000_000;
}
