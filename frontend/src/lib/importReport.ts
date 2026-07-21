import { useFindingStore, type Finding, type SeverityLevel } from '@/stores/findingStore'
import { useReportStore, type ReportFindingSummary } from '@/stores/reportStore'

export interface ParsedVulnerability {
  title: string
  severity: SeverityLevel
  description?: string
  target?: string
}

const SEV_MAP: Record<string, SeverityLevel> = {
  严重: 'critical',
  危急: 'critical',
  高危: 'high',
  高: 'high',
  中危: 'medium',
  中: 'medium',
  低危: 'low',
  低: 'low',
  信息: 'info',
  提示: 'info',
}

/** 从 markdown 文本中提取漏洞表（标准 markdown 表格格式） */
export function parseVulnerabilitiesFromMarkdown(content: string): ParsedVulnerability[] {
  const results: ParsedVulnerability[] = []
  const lines = content.split('\n')
  let inTable = false
  let headerCols: string[] = []
  let targetHint = ''

  // 先找"目标"字段
  const targetMatch = content.match(/(?:目标|测试目标|渗透目标)[\s:：]+[`*]*([^\s*`\n]+)/i)
  if (targetMatch) targetHint = targetMatch[1]

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line.startsWith('|') || !line.endsWith('|')) {
      inTable = false
      continue
    }

    // 表格分隔行 |---|---|
    if (/^\|[\s\-:|]+\|$/.test(line)) {
      inTable = true
      continue
    }

    const cells = line
      .slice(1, -1)
      .split('|')
      .map((c) => c.trim().replace(/\*\*/g, '').replace(/`/g, ''))

    if (!inTable) {
      // 可能是 header
      if (cells.some((c) => /漏洞|名称|类型|风险|severity|name/i.test(c))) {
        headerCols = cells
        inTable = true
      }
      continue
    }

    // 数据行：尝试识别"严重性 + 漏洞名"
    let title = ''
    let severity: SeverityLevel = 'medium'
    let description = ''

    for (const cell of cells) {
      if (!cell) continue
      // 严重性
      for (const k of Object.keys(SEV_MAP)) {
        if (cell.includes(k)) {
          severity = SEV_MAP[k]
          break
        }
      }
      // 标题（包含"漏洞"/"注入"/"XSS"/"RCE"/"CSRF"/"SSRF"/"越权"/"提权"/"泄露"/"劫持" 等）
      if (/漏洞|注入|XSS|RCE|CSRF|SSRF|越权|提权|泄露|劫持|未授权|上传|解析|反序列化|后门|钓鱼|欺骗|绕过|伪造|重放/.test(cell) && !title) {
        title = cell
      }
      // 描述
      if (cell.length > title.length + 5 && !title) {
        title = cell.slice(0, 60)
      }
    }

    if (title && title.length > 2) {
      results.push({
        title,
        severity,
        description: cells.join(' | '),
        target: targetHint,
      })
    }
  }
  return results
}

/** 把 markdown 内容 + 解析出的漏洞 导入到 reportStore + findingStore */
export function importReportFromMarkdown(params: {
  title: string
  content: string
  target?: string
  sourceSessionId?: string
}): { reportId: string; findingCount: number } {
  const { title, content, target, sourceSessionId } = params

  // 1. 解析漏洞 → 写入 findingStore
  const parsed = parseVulnerabilitiesFromMarkdown(content)
  const findingIds: string[] = []
  parsed.forEach((p) => {
    const id = useFindingStore.getState().addFinding({
      title: p.title,
      description: p.description || `从 AI 对话报告导入：${p.title}`,
      severity: p.severity,
      target: p.target || target || '未指定目标',
      tags: ['ai-imported', 'chat-report'],
      cve_id: 'AI-DETECTED',
      cvss_score: p.severity === 'critical' ? 9.5 : p.severity === 'high' ? 7.5 : p.severity === 'medium' ? 5.0 : 3.0,
      remediation: '请参考 AI 给出的具体修复建议',
    } as any)
    findingIds.push(id)
  })

  // 2. 统计
  const summary: ReportFindingSummary = { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: parsed.length }
  parsed.forEach((p) => { summary[p.severity]++ })

  // 3. 写入 reportStore
  const report = useReportStore.getState().createFromChat({
    title,
    content,
    target,
    source_session_id: sourceSessionId,
    severity_summary: summary,
    tags: ['ai-imported', 'chat-report', 'manual-import'],
  })

  return { reportId: report.id, findingCount: parsed.length }
}
