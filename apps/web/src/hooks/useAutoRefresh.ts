import { useEffect, useState } from "react";

export function useAutoRefresh<T>(
  path: string,
  initialValue: T,
  revision = 0,
  intervalMs = 3000,
) {
  const [data, setData] = useState<T>(initialValue);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;

    async function load() {
      controller = new AbortController();

      const timeout = setTimeout(() => {
        controller?.abort();
      }, 10000);

      try {
        const response = await fetch(`/api${path}`, {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
          headers: {
            "X-Estylo-Request": "1",
          },
        });

        if (!response.ok) {
          throw new Error(
            response.status === 401
              ? "Session expired. Please sign in again."
              : `Unable to update queue (${response.status}).`,
          );
        }

        const next = (await response.json()) as T;

        if (!stopped) {
          setData(next);
          setError("");
          setUpdatedAt(new Date());
        }
      } catch (e) {
        if (!stopped) {
          setError(
            e instanceof Error && e.name !== "AbortError"
              ? e.message
              : "Connection timed out. Retrying automatically.",
          );
        }
      } finally {
        clearTimeout(timeout);

        if (!stopped) {
          setLoading(false);
          timer = setTimeout(load, intervalMs);
        }
      }
    }

    void load();

    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
    };
  }, [path, revision, intervalMs]);

  return { data, error, loading, updatedAt };
}