// CREDIT :: from https://github.com/discord/embedded-app-sdk-examples/blob/main/discord-activity-starter/packages/server/src/utils.ts

// import { RequestInfo } from "node:fe";

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * This function extends fetch to allow retrying
 * If the request returns a 429 error code, it will wait and retry after "retry_after" seconds
 */
export async function fetchAndRetry(
  input: Parameters<typeof fetch>[0],
  init?: RequestInit | undefined,
  nRetries = 3,
): Promise<Response> {
  try {
    // Make the request
    const response = await fetch(input, init);

    // If there's a 429 error code, retry after retry_after seconds
    // https://discord.com/developers/docs/topics/rate-limits#rate-limits
    if (response.status === 429 && nRetries > 0) {
      const retryAfter = Number(response.headers.get("Retry-After"));
      if (Number.isNaN(retryAfter)) {
        return response;
      }
      await sleep(retryAfter * 1000);
      return await fetchAndRetry(input, init, nRetries - 1);
    }
    return response;
  } catch (ex) {
    if (nRetries <= 0) {
      throw ex;
    }

    // If the request failed, wait one second before trying again
    // This could probably be fancier with exponential backoff
    await sleep(1000);
    return await fetchAndRetry(input, init, nRetries - 1);
  }
}
