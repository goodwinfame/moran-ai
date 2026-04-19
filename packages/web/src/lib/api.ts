/**
 * 客户端 API 基础路径。
 * 浏览器发 /api/* → Next.js rewrite → Hono，所以用空字符串（同源）。
 * 服务端 Server Component 直连 Hono，使用 @/lib/server-api 的 API_UPSTREAM。
 */
export const API_BASE = "";

export interface ApiError {
  error: string;
  message?: string;
  status: number;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    path: string,
    options?: RequestInit,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw {
        error: body.error ?? "Unknown error",
        message: body.message,
        status: res.status,
      } satisfies ApiError;
    }

    return res.json() as Promise<T>;
  }

  get<T>(path: string) {
    return this.request<T>(path, { method: "GET" });
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  put<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  patch<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(path: string) {
    return this.request<T>(path, { method: "DELETE" });
  }

  /**
   * Create an EventSource connection for SSE
   */
  sse(path: string): EventSource {
    return new EventSource(`${this.baseUrl}${path}`);
  }
}

export const api = new ApiClient(API_BASE);
