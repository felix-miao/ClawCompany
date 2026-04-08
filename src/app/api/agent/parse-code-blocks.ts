export interface CodeBlockFile {
  path: string
  content: string
}

const FILE_ANNOTATION_REGEX = /\/\/\s*file:\s*(.+)/i
const CODE_BLOCK_REGEX = /```(\w+)?\n([\s\S]*?)```/g

export function parseCodeBlocks(markdown: string): CodeBlockFile[] {
  const files: CodeBlockFile[] = []
  let match: RegExpExecArray | null

  while ((match = CODE_BLOCK_REGEX.exec(markdown)) !== null) {
    const code = match[2]
    const pathMatch = code.match(FILE_ANNOTATION_REGEX)

    if (pathMatch) {
      files.push({
        path: pathMatch[1].trim(),
        content: code,
      })
    }
  }

  return files
}
