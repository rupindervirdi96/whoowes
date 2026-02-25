/**
 * Mock API helpers.
 * Simulates network latency and failure modes for realistic UX testing.
 *
 * Replace these with real API calls (via apiClient) when connecting to a backend.
 */

/**
 * Simulates network latency.
 * @param ms - Delay in milliseconds (default: random 300-800ms)
 */
export function mockDelay(ms?: number): Promise<void> {
  const delay = ms ?? Math.floor(Math.random() * 500) + 300;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Wraps a value in a mock ApiResponse envelope after a simulated delay.
 */
export async function mockResponse<T>(
  data: T,
  delayMs?: number,
): Promise<T> {
  await mockDelay(delayMs);
  return data;
}

/**
 * Simulates a failure response (for error handling testing).
 */
export async function mockError(
  message: string,
  statusCode: number = 400,
  delayMs?: number,
): Promise<never> {
  await mockDelay(delayMs);
  const error = { message, statusCode };
  return Promise.reject(error);
}
