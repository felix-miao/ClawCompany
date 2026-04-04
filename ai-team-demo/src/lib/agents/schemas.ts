import { z } from 'zod'

export const SubTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  assignedTo: z.enum(['dev', 'review']),
  dependencies: z.preprocess(
    (val) => Array.isArray(val) ? val : [],
    z.array(z.string())
  ),
})

export const PMAgentResponseSchema = z.object({
  analysis: z.string(),
  tasks: z.array(SubTaskSchema).default([]),
  message: z.string(),
})

export type PMAgentResponse = z.infer<typeof PMAgentResponseSchema>

export const FileChangeSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
  action: z.enum(['create', 'modify']).default('create'),
})

export const DevAgentResponseSchema = z.object({
  analysis: z.string().optional(),
  files: z.array(FileChangeSchema).default([]),
  message: z.string(),
  notes: z.array(z.string()).optional(),
})

export type DevAgentResponse = z.infer<typeof DevAgentResponseSchema>

export const ReviewCheckSchema = z.object({
  name: z.string().min(1),
  passed: z.boolean(),
  warning: z.boolean().optional(),
  message: z.string().optional(),
})

export const ReviewAgentResponseSchema = z.object({
  checks: z.array(ReviewCheckSchema).default([]),
  approved: z.boolean(),
  message: z.string(),
  suggestions: z.array(z.string()).default([]),
  score: z.number().min(0).max(100).optional(),
})

export type ReviewAgentResponse = z.infer<typeof ReviewAgentResponseSchema>
