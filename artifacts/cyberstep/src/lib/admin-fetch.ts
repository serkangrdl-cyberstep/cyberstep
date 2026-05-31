// Shared fetch helper for admin panel queries.
// Throws on non-2xx responses so React Query keeps the query's default data
// (e.g. []) instead of letting an error object ({ error: "..." }) leak into the
// component, where array methods like .map/.filter/.sort would crash the page.
export async function adminFetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, { credentials: "include", ...init });
  if (!res.ok) {
    let message = `İstek başarısız (${res.status})`;
    try {
      const data = await res.json();
      if (data && typeof data === "object" && typeof data.error === "string") {
        message = data.error;
      }
    } catch {
      // response had no JSON body; keep the default message
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}
