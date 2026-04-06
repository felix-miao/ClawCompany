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

interface MockNextURL extends NextURL {
  searchParams: URLSearchParams
  pathname: string
  hostname: string
  protocol: string
}

// 类型安全的 NextURL mock
function createMockNextUrl(urlString: string): MockNextURL {
  const url = new URL(urlString)
  const mockNextUrl = {
    buildId: undefined as string | undefined,
    locale: 'en' as string,
    defaultLocale: undefined as string | undefined,
    domainLocale: undefined as { domain: string; locale: string } | undefined,
    get searchParams() {
      return url.searchParams
    },
    get buildId() {
      return undefined as string | undefined
    },
    set buildId(_buildId: string | undefined) {},
    get locale() {
      return 'en'
    },
    set locale(_locale: string) {},
    get defaultLocale() {
      return undefined as string | undefined
    },
    get domainLocale() {
      return undefined as { domain: string; locale: string } | undefined
    },
    get host() {
      return url.host
    },
    set host(_value: string) {
      url.host = _value
    },
    get hostname() {
      return url.hostname
    },
    set hostname(_value: string) {
      url.hostname = _value
    },
    get port() {
      return url.port
    },
    set port(_value: string) {
      url.port = _value
    },
    get protocol() {
      return url.protocol
    },
    set protocol(_value: string) {
      url.protocol = _value
    },
    get href() {
      return url.href
    },
    set href(_value: string) {
      url.href = _value
    },
    get pathname() {
      return url.pathname
    },
    set pathname(_value: string) {
      url.pathname = _value
    },
    get hash() {
      return url.hash
    },
    set hash(_value: string) {
      url.hash = _value
    },
    get search() {
      return url.search
    },
    set search(_value: string) {
      url.search = _value
    }
  }

  return mockNextUrl as unknown as MockNextURL
}

// 类型安全的 RequestCookies mock
function createMockRequestCookies(): RequestCookies {
  const cookies = new Map<string, string>()
  
  return {
    get: jest.fn((name: string) => {
      const value = cookies.get(name)
      return value ? { name, value } : null
    }),
    getAll: jest.fn(() => Array.from(cookies.entries()).map(([name, value]) => ({ name, value }))),
    has: jest.fn((name: string) => cookies.has(name)),
    set: jest.fn((name: string, value: string) => {
      cookies.set(name, value)
      return this
    }),
    delete: jest.fn((name: string) => {
      cookies.delete(name)
      return this
    }),
    clear: jest.fn(() => {
      cookies.clear()
      return this
    })
  } as unknown as RequestCookies
}

// 创建一个简化的NextRequest mock
function createMockRequest(options: MockRequestOptions = {}): NextRequest {
  const url = options.url || 'http://localhost/api/agent'
  const method = options.method || 'GET'
  const headers = options.headers || {}
  const noAuth = options.noAuth || false
  const body = options.body

  // 准备headers
  const finalHeaders = new Map<string, string>()
  Object.entries(headers).forEach(([key, value]) => {
    finalHeaders.set(key.toLowerCase(), value)
  })

  // 添加API key header（仅当未提供时）
  if (!noAuth && !finalHeaders.has('x-api-key')) {
    const apiKey = process.env.AGENT_API_KEY || 'test-api-key-12345678901234567890'
    finalHeaders.set('x-api-key', apiKey)
  }

  // Mock cookies
  const mockCookies = createMockRequestCookies()

  // Mock nextUrl
  const mockNextUrl = createMockNextUrl(url)

  // 创建一个基础的request对象
  const request = {
    url,
    method,
    headers: {
      get: jest.fn((name: string) => {
        const headerKey = name.toLowerCase()
        return finalHeaders.get(headerKey) || null
      })
    },
    cookies: mockCookies,
    nextUrl: mockNextUrl,
    page: undefined,
    ua: undefined,
    json: jest.fn().mockImplementation(async () => {
      if (typeof body === 'string') {
        try {
          return JSON.parse(body)
        } catch {
          return body
        }
      }
      return body || {}
    }),
    clone: jest.fn(),
    text: jest.fn().mockResolvedValue(''),
    arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
    formData: jest.fn().mockResolvedValue(new FormData()),
    blob: jest.fn().mockResolvedValue(new Blob()),
    bodyUsed: false
  } as any

  return request as unknown as NextRequest
}

// 创建简化版 NextRequest（用于 chat API 测试）
// 签名：createMockNextRequest(body, options?)
// 注意：默认不添加 API key，需要认证时使用 createMockNextRequestWithAuth
interface CreateMockNextRequestOptions {
  headers?: Record<string, string>
  method?: string
  url?: string
}

function createMockNextRequest(
  body: Record<string, unknown>,
  options: CreateMockNextRequestOptions = {}
): NextRequest {
  return createMockRequest({
    method: options.method || 'POST',
    url: options.url || 'http://localhost/api/chat',
    headers: options.headers,
    body,
    noAuth: true  // 默认不添加认证
  })
}

// 创建带认证的请求（简化版，用于 chat API 测试）
function createMockNextRequestWithAuth(
  body: Record<string, unknown>,
  apiKey: string
): NextRequest {
  return createMockRequest({
    method: 'POST',
    headers: { 'x-api-key': apiKey },
    body
  })
}

// 导出类型安全的 mock 函数
export { createMockRequest, createMockNextUrl, createMockRequestCookies, createMockNextRequest, createMockNextRequestWithAuth }

// 辅助类型导出
export type { MockRequestOptions }