/**
 * Mock Git Manager 类型定义
 * 用于测试中的类型安全 mock 对象
 */

export interface MockGitManager {
  commit: jest.Mock<Promise<GitCommitResult>, [string]>
  commitAndPush: jest.Mock<Promise<GitCommitResult>, [string]>
  status: jest.Mock<Promise<GitStatusResult>>
  log: jest.Mock<Promise<GitLogEntry[]>>
  createBranch: jest.Mock<Promise<void>>
  checkout: jest.Mock<Promise<void>>
}

export interface GitCommitResult {
  success: boolean
  commitHash?: string
  message?: string
  error?: string
}

export interface GitStatusResult {
  branch: string
  clean?: boolean
  modified?: string[]
}

export interface GitLogEntry {
  hash: string
  message: string
}

// 全局 mock 类型声明
declare global {
  var __mockGitRouteManager__: MockGitManager
}