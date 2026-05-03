import CircuitBreaker from 'opossum';
import { openaiClient } from './openai.client';
import { withRetry } from './retry';

// The protected function: retry-wrapped OpenAI call
async function callOpenAI(path: string, body: any) {
  return withRetry(() => openaiClient.post(path, body));
}

export const openaiBreaker = new CircuitBreaker(callOpenAI, {
  timeout: 35000,               // slightly longer than client timeout
  errorThresholdPercentage: 50, // open if 50% of requests fail
  resetTimeout: 30000,          // try again after 30 seconds
  rollingCountTimeout: 60000,   // track failures over 60-second window
  rollingCountBuckets: 10,
});

// Fallback: what to return/throw when breaker is open
openaiBreaker.fallback(() => {
  throw new Error('OpenAI is temporarily unavailable. Please try again shortly.');
});

// State change visibility
openaiBreaker.on('open', () =>
  console.warn('⚠️  OpenAI circuit breaker OPENED — failing fast'));
openaiBreaker.on('halfOpen', () =>
  console.warn('⚠️  OpenAI circuit breaker HALF-OPEN — testing recovery'));
openaiBreaker.on('close', () =>
  console.log('✅ OpenAI circuit breaker CLOSED — normal operation'));
