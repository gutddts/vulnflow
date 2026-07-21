import { requestAI } from '@/hooks/useLLM'
import { useFindingStore } from '@/stores/findingStore'

/**
 * AI 生成 POC —— 调自有 LLM 生成 payload + 流量 + 修复建议
 */
export async function generatePOCFromAI(findingId: string): Promise<void> {
  const store = useFindingStore.getState()
  const finding = store.findings.find((f) => f.id === findingId)
  if (!finding) throw new Error('漏洞不存在')

  const systemPrompt = `你是一个红队渗透测试专家。针对用户提供的漏洞，生成真实的攻击 POC。规则：所有命令/payload/流量必须真实可用，目标使用用户提供的真实值，POC 命令使用 sqlmap/msfconsole/dalfox/impacket/curl 等真实工具`

  const prompt = `请为以下漏洞生成完整的攻击验证数据：

## 漏洞信息
- 标题：${finding.title}
- 描述：${finding.description}
- 目标：${finding.target}
- 严重性：${finding.severity}${finding.cvss_score ? ` (CVSS: ${finding.cvss_score})` : ''}
${finding.cve_id ? `- CVE: ${finding.cve_id}` : ''}

## 要求输出格式
### Payload
\`\`\`
（具体的攻击 payload）
\`\`\`

### 网络流量
\`\`\`
（模拟的 HTTP 请求/响应）
\`\`\`

### POC 命令
\`\`\`
（使用真实工具的命令行）
\`\`\`

### 修复建议
（具体可操作的修复步骤）`

  const raw = await requestAI(prompt, systemPrompt)
  store.updateFinding(findingId, { evidence: raw })
}
</content>
