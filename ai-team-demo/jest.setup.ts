import '@testing-library/jest-dom'

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

// Mock react-markdown for tests
jest.mock('react-markdown', () => {
  return ({ children }: { children: React.ReactNode }) => children
})

jest.mock('remark-gfm', () => () => {})
