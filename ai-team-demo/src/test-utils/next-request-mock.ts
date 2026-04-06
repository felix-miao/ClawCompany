/**
 * 类型安全的 NextRequest mock
 * 解决原测试文件中的 TypeScript 类型错误
 */

// Jest环境检查
const isJest = typeof jest !== 'undefined'

// 在Jest环境中创建基础的Request mock
let globalRequest: any
if (isJest) {
  // Jest环境下的Request实现
  globalRequest = class Request {
    constructor(input: string | Request, init?: RequestInit) {
      this.url = typeof input === 'string' ? input : input.url
      this.method = init?.method || 'GET'
      this.headers = new Map()
      
      // 设置headers
      if (init?.headers) {
        const headers = init.headers instanceof Headers ? init.headers : 
                        Array.isArray(init.headers) ? init.headers :
                        Object.entries(init.headers)
        
        headers.forEach(([key, value]) => {
          this.headers.set(key, value as string)
        })
      }
    }

    url: string
    method: string
    headers: Map<string, string>
    body?: BodyInit | null

    clone(): Request {
      return new Request(this.url, {
        method: this.method,
        headers: Object.fromEntries(this.headers)
      })
    }

    text(): Promise<string> {
      return Promise.resolve('')
    }

    json(): Promise<any> {
      return Promise.resolve({})
    }

    arrayBuffer(): Promise<ArrayBuffer> {
      return Promise.resolve(new ArrayBuffer(0))
    }

    formData(): Promise<FormData> {
      return Promise.resolve(new FormData())
    }

    blob(): Promise<Blob> {
      return Promise.resolve(new Blob())
    }

    bodyUsed = false
  }
}

interface MockRequestOptions {
  url?: string
  method?: string
  headers?: Record<string, string>
  noAuth?: boolean
  body?: Record<string, unknown> | string
}

interface MockNextURL {
  searchParams: URLSearchParams
  pathname: string
  hostname: string
  protocol: string
  buildId?: string
  locale?: string
  defaultLocale?: string
  domainLocale?: { domain: string; locale: string }
}

// 类型安全的 NextURL mock
function createMockNextUrl(urlString: string): MockNextURL {
  const url = new URL(urlString)
  const mockNextUrl: MockNextURL = {
    searchParams: url.searchParams,
    pathname: url.pathname,
    hostname: url.hostname,
    protocol: url.protocol,
    buildId: undefined,
    locale: 'en',
    defaultLocale: undefined,
    domainLocale: undefined
  }
  return mockNextUrl
}

// 创建cookies mock
function createMockCookies(headers: Map<string, string>): any {
  const cookieMap = new Map<string, string>()
  
  // 从headers中解析cookie
  const cookieHeader = headers.get('cookie')
  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const [key, value] = cookie.trim().split('=')
      if (key && value) {
        cookieMap.set(key, value)
      }
    })
  }

  return {
    get: (name: string) => cookieMap.get(name) || null,
    set: jest.fn(),
    delete: jest.fn(),
    has: (name: string) => cookieMap.has(name),
    getAll: () => Array.from(cookieMap.entries()),
    clear: () => {
      cookieMap.clear()
    }
  }
}

// 创建NextRequest mock
function createMockNextRequest(options: MockRequestOptions = {}): any {
  const url = options.url || 'http://localhost:3000/api/test'
  const method = options.method || 'POST'
  const headers = new Map<string, string>()
  
  // 设置默认headers
  headers.set('content-type', 'application/json')
  headers.set('user-agent', 'jest-test')
  
  // 添加认证头部（除非明确要求 noAuth）
  if (!options.noAuth && process.env.AGENT_API_KEY) {
    headers.set('x-api-key', process.env.AGENT_API_KEY)
  }
  
  // 添加自定义headers
  if (options.headers) {
    Object.entries(options.headers).forEach(([key, value]) => {
      headers.set(key, value as string)
    })
  }
  
  // 创建基础的Request对象
  const request = new globalRequest(url, {
    method,
    headers: Object.fromEntries(headers)
  })
  
  // 添加Next.js特有的属性
  const mockNextUrl = createMockNextUrl(url)

  // 创建 headers wrapper 对象（符合 Headers API）
  const mockHeaders = {
    get: (name: string) => headers.get(name) || null,
    has: (name: string) => headers.has(name),
    set: (name: string, value: string) => {
      headers.set(name, value)
      return mockHeaders
    },
    delete: (name: string) => headers.delete(name),
    append: (name: string, value: string) => {
      const existing = headers.get(name)
      if (existing) {
        headers.set(name, `${existing}, ${value}`)
      } else {
        headers.set(name, value)
      }
      return mockHeaders
    },
    entries: () => headers.entries(),
    keys: () => headers.keys(),
    values: () => headers.values(),
    forEach: (callback: (value: string, key: string) => void) => headers.forEach(callback)
  }

  const mockRequest: any = {
    ...request,
    headers: mockHeaders,  // 覆盖 spread 的 headers Map
    cookies: createMockCookies(headers),
    nextUrl: mockNextUrl,
    page: {
      pathname: url,
      searchParams: mockNextUrl.searchParams
    },
    ua: {
      getBrowserName: () => 'jest',
      getOSName: () => 'jest',
      getDeviceType: () => 'desktop'
    },
    geo: {
      country: undefined,
      region: undefined,
      city: undefined,
      latitude: undefined,
      longitude: undefined
    },
    ip: undefined,
    host: url,
    protocol: 'https',
    url: url,
    
    // 添加一些常用的方法
    clone: () => createMockNextRequest({ ...options, method }),
    text: async () => options.body ? JSON.stringify(options.body) : '',
    json: async () => options.body ? options.body : {},
    arrayBuffer: async () => new ArrayBuffer(0)
  }
  
  return mockRequest
}

// 向后兼容的别名
const createMockRequest = createMockNextRequest

// 带认证的便捷函数（兼容旧API）
function createMockNextRequestWithAuth(body: Record<string, unknown>, apiKey?: string): any {
  const key = apiKey || process.env.AGENT_API_KEY || 'test-api-key'
  return createMockNextRequest({
    method: 'POST',
    headers: { 'x-api-key': key },
    body
  })
}

export { createMockNextRequest, createMockNextUrl, createMockRequest, createMockNextRequestWithAuth }
export type { MockRequestOptions, MockNextURL }