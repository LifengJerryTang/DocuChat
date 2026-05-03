import axios, { AxiosInstance, AxiosError } from 'axios';

export const openaiClient: AxiosInstance = axios.create({
  baseURL: 'https://api.openai.com/v1',
  timeout: 30000,
  headers: {
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
    'User-Agent': 'DocuChat/1.0',
  },
});

// Request interceptor — record start time for duration logging
openaiClient.interceptors.request.use((config) => {
  (config as any).metadata = { startTime: Date.now() };
  console.log(`→ OpenAI ${config.method?.toUpperCase()} ${config.url}`);
  return config;
});

// Response interceptor — log timing and distinguish failure types
openaiClient.interceptors.response.use(
  (response) => {
    const duration = Date.now() - (response.config as any).metadata?.startTime;
    console.log(`← OpenAI ${response.status} ${response.config.url} (${duration}ms)`);

    // Read rate limit headers and warn when budget is low
    const remaining = parseInt(
      response.headers['x-ratelimit-remaining-requests'] ?? '999'
    );
    if (remaining < 50) {
      console.warn(`⚠️  OpenAI rate limit low: ${remaining} requests remaining`);
    }

    return response;
  },
  (error: AxiosError) => {
    const duration = Date.now() - (error.config as any)?.metadata?.startTime;

    if (error.response) {
      // Case 1: server replied with 4xx or 5xx
      console.error(
        `✕ OpenAI ${error.response.status} ${error.config?.url} (${duration}ms):`,
        error.response.data
      );
    } else if (error.request) {
      // Case 2: request sent, no response (timeout / network error)
      console.error(
        `✕ OpenAI no response ${error.config?.url} (${duration}ms):`,
        error.message
      );
    } else {
      // Case 3: request never sent (bad config / setup error)
      console.error(`✕ OpenAI request setup error:`, error.message);
    }

    return Promise.reject(error);
  }
);
