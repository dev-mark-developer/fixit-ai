import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

/**
 * Dev-only API logger. Attaches request/response interceptors that print
 * every call with its headers, params, payload and response body to the
 * Metro console. No-op in release builds.
 */

const MAX_BODY_CHARS = 4000;

// Avoid dumping full bearer tokens into logs
function maskHeaders(headers: Record<string, unknown> | undefined) {
  if (!headers) return headers;
  const out: Record<string, unknown> = {};
  Object.entries(headers).forEach(([key, value]) => {
    if (key.toLowerCase() === 'authorization' && typeof value === 'string') {
      out[key] = `${value.slice(0, 18)}…(masked)`;
    } else {
      out[key] = value;
    }
  });
  return out;
}

function printable(data: unknown): unknown {
  if (data == null) return undefined;
  // React Native FormData exposes its entries via _parts
  const parts = (data as { _parts?: unknown[] })?._parts;
  if (parts) return { formData: parts };
  try {
    const json = typeof data === 'string' ? data : JSON.stringify(data);
    return json.length > MAX_BODY_CHARS
      ? `${json.slice(0, MAX_BODY_CHARS)}… (${json.length} chars, truncated)`
      : typeof data === 'string' ? data : JSON.parse(json);
  } catch {
    return '[unserializable]';
  }
}

type TimedConfig = InternalAxiosRequestConfig & { _startedAt?: number };

export function attachApiLogger(api: AxiosInstance) {
  if (!__DEV__) return;

  api.interceptors.request.use(config => {
    (config as TimedConfig)._startedAt = Date.now();
    const method = (config.method ?? 'get').toUpperCase();
    console.log(
      `🌐 [API →] ${method} ${config.baseURL ?? ''}${config.url}`,
      {
        headers: maskHeaders(config.headers?.toJSON ? config.headers.toJSON() : (config.headers as any)),
        params: config.params,
        body: printable(config.data),
      },
    );
    return config;
  });

  api.interceptors.response.use(
    response => {
      const cfg = response.config as TimedConfig;
      const ms = cfg._startedAt ? `${Date.now() - cfg._startedAt}ms` : '?';
      const method = (cfg.method ?? 'get').toUpperCase();
      console.log(
        `✅ [API ←] ${response.status} ${method} ${cfg.url} (${ms})`,
        { response: printable(response.data) },
      );
      return response;
    },
    error => {
      const cfg = (error.config ?? {}) as TimedConfig;
      const ms = cfg._startedAt ? `${Date.now() - cfg._startedAt}ms` : '?';
      const method = (cfg.method ?? 'get').toUpperCase();
      if (error.response) {
        console.log(
          `❌ [API ←] ${error.response.status} ${method} ${cfg.url} (${ms})`,
          { response: printable(error.response.data) },
        );
      } else {
        // Nothing came back at all. axios says "Network Error" for every
        // one of these, so the code is the only thing that separates a
        // dropped connection (ERR_NETWORK) from a client timeout
        // (ECONNABORTED) from a cancelled request (ERR_CANCELED) — worth
        // printing, since they have completely different causes.
        const code = error.code ? ` [${error.code}]` : '';
        console.log(
          `❌ [API ✕] ${method} ${cfg.url} (${ms}) — ${error.message}${code}`,
        );
      }
      return Promise.reject(error);
    },
  );
}
