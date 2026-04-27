import '@testing-library/jest-dom'
import { TextEncoder, TextDecoder } from 'util'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

Object.assign(global, { TextEncoder, TextDecoder })
globalThis.IS_REACT_ACT_ENVIRONMENT = true

// Note: Next.js provides Request/Response polyfills automatically
// No need to manually polyfill in Node.js 18+

// Mock scrollIntoView for tests
Element.prototype.scrollIntoView = jest.fn()

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))
