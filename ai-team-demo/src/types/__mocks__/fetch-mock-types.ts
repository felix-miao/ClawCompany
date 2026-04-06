/**
 * Fetch Mock 类型定义
 * 用于测试中的类型安全 fetch mock
 */

import { Response } from 'node-fetch'

export interface MockFetchFunction {
  (input: RequestInfo | URL, init?: RequestInit): Promise<Response>
}

// 全局 mock 类型声明
declare global {
  var __mockFetch__: MockFetchFunction
}