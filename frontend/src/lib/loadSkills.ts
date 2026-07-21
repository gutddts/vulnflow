// 从 public/skills/ 目录自动加载所有技能文件
// index.json 格式: { files: [{ path: "nmap.md", name: "nmap" }, ...] }
// 或者直接放 .md 文件，由前端自动发现

const SKILLS_DIR = '/skills/'

let cachedBuiltinSkills: ParsedSkill[] | null = null

export type ParsedSkillFormat = 'md' | 'yaml' | 'json' | 'text'

export interface ParsedSkill {
  name: string
  display_name: string
  description: string
  long_description: string
  category: string
  severity: string
  author: string
  version: string
  tags: string[]
  estimated_time: number
  risk_level: string
  icon?: string
}

function parseFrontmatter(content: string): Record<string, string | string[]> {
  const fm: Record<string, string | string[]> = {}
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/)
  if (!match) return fm
  for (const line of match[1].split('\n')) {
    const m = line.match(/^(\w[\w_-]*)\s*:\s*(.+)$/)
    if (!m) continue
    let val: string | string[] = m[2].trim()
    if (val.startsWith('[') && val.endsWith(']')) {
      val = val.slice(1, -1).split(',').map((t) => t.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
    } else if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1)
    }
    fm[m[1]] = val
  }
  return fm
}

function parseMdToSkill(fileName: string, content: string): ParsedSkill {
  const fm = parseFrontmatter(content)
  const body = content.replace(/^---[\s\S]*?\n---\n?/, '').trim()
  const baseName = fileName.replace(/\.(md|markdown)$/i, '')
  return {
    name: (fm.name as string) || baseName.toLowerCase().replace(/[^a-z0-9_]+/g, '_'),
    display_name: (fm.display_name as string) || baseName,
    description: (fm.description as string) || body.slice(0, 100).replace(/[#*`]/g, '').trim() || '无描述',
    long_description: body.slice(0, 2000),
    category: (fm.category as string) || 'custom',
    severity: (fm.severity as string) || 'medium',
    author: (fm.author as string) || 'unknown',
    version: (fm.version as string) || '1.0.0',
    tags: Array.isArray(fm.tags) ? fm.tags as string[] : [],
    estimated_time: parseInt((fm.estimated_time as string) || '60', 10),
    risk_level: (fm.risk_level as string) || 'medium',
    icon: (fm.icon as string) || 'FileText',
  }
}

/**
 * 获取所有内置技能（public/skills/ 下的文件）
 */
export async function loadBuiltinSkills(): Promise<ParsedSkill[]> {
  if (cachedBuiltinSkills) return cachedBuiltinSkills

  try {
    // 1. 先尝试加载 index.json
    const indexRes = await fetch(`${SKILLS_DIR}index.json`).catch(() => null)
    if (indexRes?.ok) {
      const index = await indexRes.json()
      const files: string[] = index.files || index
      const skills: ParsedSkill[] = []
      for (const file of files) {
        try {
          const res = await fetch(`${SKILLS_DIR}${file}`)
          if (res.ok) {
            const text = await res.text()
            skills.push(parseMdToSkill(file, text))
          }
        } catch { /* skip */ }
      }
      cachedBuiltinSkills = skills
      return skills
    }
  } catch { /* no index.json */ }

  // 2. fallback: 尝试加载已知的单个文件（通过 index.json 中的默认文件）
  // 如果没有 index.json，返回空列表
  cachedBuiltinSkills = []
  return []
}

export function clearBuiltinSkillsCache() {
  cachedBuiltinSkills = null
}
