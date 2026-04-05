import { NextRequest } from 'next/server';

/**
 * 创建一个完整的 NextRequest mock 对象
 * 用于测试 API routes
 */
export function createMockNextRequest(
  data: Record<string, unknown> = {},
  options: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
  } = {}
): NextRequest {
  const {
    method = 'POST',
    url = 'http://localhost:3000/api/test',
    headers = {},
  } = options;

  const request = {
    json: async () => data,
    text: async () => JSON.stringify(data),
    headers: {
      get: (name: string) => headers[name] || null,
      ...headers,
    },
    method,
    url,
    nextUrl: new URL(url),
    cookies: {
      get: () => null,
      getAll: () => [],
      delete: () => {},
      set: () => {},
    },
    page: null,
    ua: null,
    geo: null,
    ip: null,
    referrer: null,
    headersEntries: () => Object.entries(headers),
    clone: () => request,
  } as unknown as NextRequest;

  return request;
}

/**
 * 创建一个带 API key 的 NextRequest mock
 */
export function createMockNextRequestWithAuth(
  data: Record<string, unknown> = {},
  apiKey: string = 'test-api-key',
  options: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
  } = {}
): NextRequest {
  return createMockNextRequest(data, {
    ...options,
    headers: {
      'x-api-key': apiKey,
      ...options.headers,
    },
  });
}
