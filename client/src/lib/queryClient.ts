import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(url: string, options?: RequestInit): Promise<any> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {})
  };
  const addTokenParam = (u: string) => {
    if (!token) return u;
    try {
      const hasApiPrefix = u.startsWith('/api/');
      const hasToken = /[?&]token=/.test(u);
      if (hasApiPrefix && !hasToken) {
        const sep = u.includes('?') ? '&' : '?';
        return `${u}${sep}token=${encodeURIComponent(token)}`;
      }
    } catch {}
    return u;
  };

  const res = await fetch(addTokenParam(url), {
    ...options,
    headers: {
      ...headers,
      ...options?.headers
    }
  });

  await throwIfResNotOk(res);
  return await res.json();
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const token = localStorage.getItem('token');
    const reqUrl = (() => {
      const u = queryKey.join("/") as string;
      if (!token) return u;
      try {
        const hasApiPrefix = u.startsWith('/api/');
        const hasToken = /[?&]token=/.test(u);
        if (hasApiPrefix && !hasToken) {
          const sep = u.includes('?') ? '&' : '?';
          return `${u}${sep}token=${encodeURIComponent(token)}`;
        }
      } catch {}
      return u;
    })();

    const res = await fetch(reqUrl, {
      headers: token ? { "Authorization": `Bearer ${token}` } : {}
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
