import { createMockNextRequest } from './src/test-utils/next-request-mock'

describe('NextRequest Mock Test', () => {
  it('should create a valid mock request', () => {
    const request = createMockNextRequest({
      url: 'http://localhost/api/agent',
      method: 'POST'
    })

    expect(request).toBeDefined()
    expect(request.url).toBe('http://localhost/api/agent')
    expect(request.method).toBe('POST')
  })

  it('should handle JSON body', async () => {
    const request = createMockNextRequest({
      method: 'POST',
      body: {
        agentId: 'pm-agent',
        userMessage: 'Hello'
      }
    })

    const body = await request.json()
    expect(body).toEqual({
      agentId: 'pm-agent',
      userMessage: 'Hello'
    })
  })

  it('should get headers correctly', () => {
    const request = createMockNextRequest({
      headers: {
        'content-type': 'application/json',
        'x-custom-header': 'test-value'
      }
    })

    expect(request.headers.get('content-type')).toBe('application/json')
    expect(request.headers.get('x-custom-header')).toBe('test-value')
    expect(request.headers.get('non-existent')).toBeNull()
  })

  it('should have cookies property', () => {
    const request = createMockNextRequest()
    
    expect(request.cookies).toBeDefined()
    expect(typeof request.cookies.get).toBe('function')
    expect(typeof request.cookies.has).toBe('function')
  })

  it('should have nextUrl property', () => {
    const request = createMockNextRequest({
      url: 'http://localhost/api/agent?test=123'
    })
    
    expect(request.nextUrl).toBeDefined()
    expect(request.nextUrl.pathname).toBe('/api/agent')
    expect(request.nextUrl.searchParams.get('test')).toBe('123')
  })

  it('should include API key by default', () => {
    const originalApiKey = process.env.AGENT_API_KEY
    process.env.AGENT_API_KEY = 'test-api-key'

    const request = createMockNextRequest()

    expect(request.headers.get('x-api-key')).toBeDefined()
    expect(request.headers.get('x-api-key')).toBe('test-api-key')

    process.env.AGENT_API_KEY = originalApiKey
  })

  it('should skip API key when noAuth is true', () => {
    const request = createMockNextRequest({
      noAuth: true
    })
    
    expect(request.headers.get('x-api-key')).toBeNull()
  })
})