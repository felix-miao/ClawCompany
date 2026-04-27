import '@testing-library/jest-dom'
import { TextEncoder, TextDecoder } from 'util'

Object.assign(global, { TextEncoder, TextDecoder })
globalThis.IS_REACT_ACT_ENVIRONMENT = true

// Note: Next.js provides Request/Response polyfills automatically
// No need to manually polyfill in Node.js 18+

// Mock scrollIntoView for tests
if (typeof Element !== 'undefined') {
  Element.prototype.scrollIntoView = jest.fn()
}

// Mock IntersectionObserver
if (typeof global.IntersectionObserver === 'undefined') {
  global.IntersectionObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }))
}

// Mock ResizeObserver
if (typeof global.ResizeObserver === 'undefined') {
  global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }))
}
