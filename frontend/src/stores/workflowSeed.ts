import type { WorkflowNode, WorkflowEdge } from '@/types/workflow'

interface WorkflowTemplate {
  id: string
  name: string
  description: string
  icon: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  tags: string[]
  reference?: string
}

// 创建一个工作流构建器：传入 nodes 列表 + edges 关系（按 label 引用）
function buildWorkflow(
  spec: Array<{
    label: string
    type: WorkflowNode['type']
    x: number
    y: number
    config?: Record<string, unknown>
  }>,
  links: Array<[string, string, string?]>, // [fromLabel, toLabel, edgeType?]
): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  const nodes: WorkflowNode[] = spec.map((s, i) => ({
    id: `node-${Date.now()}-${i}-${Math.floor(Math.random() * 1e6)}`,
    type: s.type,
    label: s.label,
    position: { x: s.x, y: s.y },
    config: s.config || {},
    status: 'idle',
  }))
  const label2id = new Map<string, string>()
  spec.forEach((s, i) => label2id.set(s.label, nodes[i].id))

  const edges: WorkflowEdge[] = links.map(([from, to, type], i) => ({
    id: `edge-${Date.now()}-${i}-${Math.floor(Math.random() * 1e6)}`,
    source: label2id.get(from) || from,
    target: label2id.get(to) || to,
    type: (type as WorkflowEdge['type']) || 'sequential',
  }))

  return { nodes, edges }
}

// ================================================================
//  工作流 1: 完整外网渗透测试
// ================================================================
const RED_TEAM_FULL: WorkflowTemplate = {
  id: 'wf-red-full',
  name: '🔴 红队完整外网渗透测试',
  description: '覆盖 8 阶段完整外网渗透流程：子域枚举 → 端口扫描 → 服务识别 → Web 漏洞检测 → SQL/XSS 利用 → 权限提升 → 横向移动 → 报告生成。参考 AutoRedTeam-Orchestrator 的攻击链编排。',
  icon: '🎯',
  tags: ['red-team', 'full-chain', 'web', 'network', 'external'],
  reference: 'AutoRedTeam-Orchestrator / catchclaw DAG',
  ...buildWorkflow(
    [
      { label: '子域名枚举', type: 'data_collection', x: 80, y: 30, config: { tool: 'subfinder', dict: 'all' } },
      { label: 'IP 解析与存活检测', type: 'data_collection', x: 400, y: 30, config: { tool: 'httpx' } },
      { label: 'Nmap 全端口扫描', type: 'nmap_scan', x: 80, y: 160, config: { ports: '1-65535', timing: 'T4' } },
      { label: '服务版本识别', type: 'nmap_scan', x: 400, y: 160, config: { ports: 'top-1000', sv: true } },
      { label: 'Web 漏洞扫描', type: 'vulnerability_scan', x: 80, y: 290, config: { tool: 'nuclei' } },
      { label: '接口目录爆破', type: 'vulnerability_scan', x: 400, y: 290, config: { tool: 'ffuf' } },
      { label: 'SQL 注入利用', type: 'exploit', x: 80, y: 420, config: { tool: 'sqlmap' } },
      { label: 'XSS 检测与利用', type: 'exploit', x: 400, y: 420, config: { tool: 'dalfox' } },
      { label: 'SSRF 探测', type: 'exploit', x: 240, y: 550, config: { tool: 'collaborator' } },
      { label: '权限提升探测', type: 'post_exploit', x: 80, y: 680, config: { tool: 'linpeas-winpeas' } },
      { label: '内网横向扫描', type: 'post_exploit', x: 400, y: 680, config: { protocol: 'smb-ssh-rdp' } },
      { label: '渗透测试报告', type: 'report', x: 240, y: 810, config: { format: 'pdf' } },
    ],
    [
      ['子域名枚举', 'IP 解析与存活检测', 'sequential'],
      ['IP 解析与存活检测', 'Nmap 全端口扫描', 'sequential'],
      ['IP 解析与存活检测', '服务版本识别', 'parallel'],
      ['Nmap 全端口扫描', 'Web 漏洞扫描', 'sequential'],
      ['服务版本识别', 'Web 漏洞扫描', 'sequential'],
      ['Web 漏洞扫描', '接口目录爆破', 'parallel'],
      ['Web 漏洞扫描', 'SQL 注入利用', 'sequential'],
      ['接口目录爆破', 'XSS 检测与利用', 'parallel'],
      ['SQL 注入利用', 'SSRF 探测', 'sequential'],
      ['XSS 检测与利用', 'SSRF 探测', 'sequential'],
      ['SSRF 探测', '权限提升探测', 'sequential'],
      ['权限提升探测', '内网横向扫描', 'parallel'],
      ['内网横向扫描', '渗透测试报告', 'sequential'],
    ],
  ),
}

// ================================================================
//  工作流 2: Web 应用深度渗透（OWASP Top 10）
// ================================================================
const RED_TEAM_WEB: WorkflowTemplate = {
  id: 'wf-red-web',
  name: '🔴 Web 应用深度渗透（OWASP Top 10）',
  description: '覆盖 OWASP Top 10 全类别检测：注入、XSS、SSRF、文件上传、反序列化、CORS/Security Misconfig。多节点并行扫描 + 串联利用验证。',
  icon: '🌐',
  tags: ['red-team', 'web', 'owasp', 'multi-node'],
  ...buildWorkflow(
    [
      { label: 'Web 指纹识别', type: 'data_collection', x: 80, y: 30 },
      { label: 'SQL 注入扫描', type: 'vulnerability_scan', x: 80, y: 160 },
      { label: 'XSS 扫描', type: 'vulnerability_scan', x: 300, y: 160 },
      { label: '文件上传检测', type: 'vulnerability_scan', x: 520, y: 160 },
      { label: 'SSRF 探测', type: 'vulnerability_scan', x: 740, y: 160 },
      { label: 'SQL 注入利用', type: 'exploit', x: 80, y: 290 },
      { label: 'XSS 会话劫持', type: 'exploit', x: 300, y: 290 },
      { label: '文件上传 RCE', type: 'exploit', x: 520, y: 290 },
      { label: 'SSRF 内网利用', type: 'exploit', x: 740, y: 290 },
      { label: 'Cookie Token 提取', type: 'post_exploit', x: 300, y: 420 },
      { label: 'OWASP 报告', type: 'report', x: 300, y: 550 },
    ],
    [
      ['Web 指纹识别', 'SQL 注入扫描', 'parallel'],
      ['Web 指纹识别', 'XSS 扫描', 'parallel'],
      ['Web 指纹识别', '文件上传检测', 'parallel'],
      ['Web 指纹识别', 'SSRF 探测', 'parallel'],
      ['SQL 注入扫描', 'SQL 注入利用', 'sequential'],
      ['XSS 扫描', 'XSS 会话劫持', 'sequential'],
      ['文件上传检测', '文件上传 RCE', 'sequential'],
      ['SSRF 探测', 'SSRF 内网利用', 'sequential'],
      ['XSS 会话劫持', 'Cookie Token 提取', 'sequential'],
      ['文件上传 RCE', 'Cookie Token 提取', 'sequential'],
      ['Cookie Token 提取', 'OWASP 报告', 'sequential'],
    ],
  ),
}

// ================================================================
//  工作流 3: 内网渗透 + 横向移动
// ================================================================
const RED_TEAM_INTERNAL: WorkflowTemplate = {
  id: 'wf-red-internal',
  name: '🔴 内网渗透与横向移动',
  description: '专攻 Windows 域环境内网渗透：SMB 枚举 → Kerberos 攻击 → AD CS 利用 → DCSync → 横向 RDP/PsExec → 痕迹清理。覆盖 ATT&CK TA0008-TA0040 全阶段。',
  icon: '🏢',
  tags: ['red-team', 'internal', 'ad', 'lateral', 'windows'],
  reference: 'ATT&CK TA0008 ~ TA0040',
  ...buildWorkflow(
    [
      { label: 'LDAP 域信息枚举', type: 'data_collection', x: 80, y: 30 },
      { label: 'SMB 共享枚举', type: 'data_collection', x: 400, y: 30 },
      { label: 'Kerberos 攻击面', type: 'vulnerability_scan', x: 80, y: 160 },
      { label: 'AD CS 漏洞检测', type: 'vulnerability_scan', x: 400, y: 160 },
      { label: '内网主机发现', type: 'nmap_scan', x: 80, y: 290 },
      { label: 'Kerberoast 破解', type: 'exploit', x: 80, y: 420 },
      { label: 'AD CS ESC1 利用', type: 'exploit', x: 400, y: 420 },
      { label: 'DCSync 攻击', type: 'exploit', x: 240, y: 550 },
      { label: '横向 RDP 移动', type: 'post_exploit', x: 80, y: 680 },
      { label: 'PsExec 横向执行', type: 'post_exploit', x: 400, y: 680 },
      { label: '内网渗透报告', type: 'report', x: 240, y: 810 },
    ],
    [
      ['LDAP 域信息枚举', 'SMB 共享枚举', 'parallel'],
      ['LDAP 域信息枚举', 'Kerberos 攻击面', 'sequential'],
      ['SMB 共享枚举', 'AD CS 漏洞检测', 'sequential'],
      ['Kerberos 攻击面', '内网主机发现', 'parallel'],
      ['Kerberos 攻击面', 'Kerberoast 破解', 'sequential'],
      ['AD CS 漏洞检测', 'AD CS ESC1 利用', 'sequential'],
      ['Kerberoast 破解', 'DCSync 攻击', 'sequential'],
      ['AD CS ESC1 利用', 'DCSync 攻击', 'sequential'],
      ['DCSync 攻击', '横向 RDP 移动', 'sequential'],
      ['DCSync 攻击', 'PsExec 横向执行', 'parallel'],
      ['PsExec 横向执行', '内网渗透报告', 'sequential'],
    ],
  ),
}

// ================================================================
//  工作流 4: MCP 工具链与 AI Red Team（参考 CatchClaw）
// ================================================================
const RED_TEAM_MCP: WorkflowTemplate = {
  id: 'wf-red-mcp',
  name: '🔴 MCP 工具链与 AI Red Team 安全评估',
  description: '基于 CatchClaw / AutoRedTeam-Orchestrator 思路，评估 MCP Server 安全性：工具投毒 → 越权调用 → Agent 劫持 → 沙箱逃逸 → 凭据窃取。',
  icon: '🤖',
  tags: ['red-team', 'mcp', 'ai-security', 'catchclaw', 'agent'],
  reference: 'CatchClaw v5.3 / AutoRedTeam-Orchestrator',
  ...buildWorkflow(
    [
      { label: 'MCP 端点配置', type: 'input', x: 80, y: 30 },
      { label: 'MCP 工具清单枚举', type: 'data_collection', x: 80, y: 160 },
      { label: 'MCP 注入检测', type: 'vulnerability_scan', x: 400, y: 160 },
      { label: '工具投毒测试', type: 'vulnerability_scan', x: 80, y: 290 },
      { label: 'Agent 劫持利用', type: 'exploit', x: 400, y: 290 },
      { label: '沙箱逃逸测试', type: 'exploit', x: 80, y: 420 },
      { label: '凭据密钥窃取', type: 'exploit', x: 400, y: 420 },
      { label: 'CatchClaw 攻击链执行', type: 'mcp_tool', x: 240, y: 550 },
      { label: 'AI 红队报告', type: 'report', x: 240, y: 680 },
    ],
    [
      ['MCP 端点配置', 'MCP 工具清单枚举', 'sequential'],
      ['MCP 工具清单枚举', 'MCP 注入检测', 'parallel'],
      ['MCP 工具清单枚举', '工具投毒测试', 'parallel'],
      ['MCP 注入检测', 'Agent 劫持利用', 'sequential'],
      ['工具投毒测试', '沙箱逃逸测试', 'sequential'],
      ['Agent 劫持利用', '凭据密钥窃取', 'parallel'],
      ['沙箱逃逸测试', 'CatchClaw 攻击链执行', 'sequential'],
      ['凭据密钥窃取', 'CatchClaw 攻击链执行', 'sequential'],
      ['CatchClaw 攻击链执行', 'AI 红队报告', 'sequential'],
    ],
  ),
}

// ================================================================
//  工作流 5: 云环境安全评估
// ================================================================
const RED_TEAM_CLOUD: WorkflowTemplate = {
  id: 'wf-red-cloud',
  name: '🔴 云环境安全评估（AWS/Azure/GCP）',
  description: '覆盖云服务三大提供商的安全评估：IAM 权限枚举 → S3/Blob 公开桶检查 → EC2/VMs 元数据 SSRF → Lambda 函数 RCE → KMS 密钥滥用 → k8s RBAC 渗透。',
  icon: '☁️',
  tags: ['red-team', 'cloud', 'aws', 'azure', 'gcp', 'k8s'],
  ...buildWorkflow(
    [
      { label: 'IAM 权限枚举', type: 'data_collection', x: 80, y: 30 },
      { label: '公开存储桶检测', type: 'data_collection', x: 400, y: 30 },
      { label: '元数据 SSRF 探测', type: 'vulnerability_scan', x: 80, y: 160 },
      { label: 'K8s RBAC 评估', type: 'vulnerability_scan', x: 400, y: 160 },
      { label: '公有桶数据提取', type: 'exploit', x: 80, y: 290 },
      { label: 'IAM 提权', type: 'exploit', x: 400, y: 290 },
      { label: 'MCP 云工具调用', type: 'mcp_tool', x: 240, y: 420 },
      { label: '云安全评估报告', type: 'report', x: 240, y: 550 },
    ],
    [
      ['IAM 权限枚举', '公开存储桶检测', 'parallel'],
      ['IAM 权限枚举', '元数据 SSRF 探测', 'sequential'],
      ['公开存储桶检测', 'K8s RBAC 评估', 'parallel'],
      ['元数据 SSRF 探测', '公有桶数据提取', 'sequential'],
      ['K8s RBAC 评估', 'IAM 提权', 'sequential'],
      ['公有桶数据提取', 'MCP 云工具调用', 'sequential'],
      ['IAM 提权', 'MCP 云工具调用', 'sequential'],
      ['MCP 云工具调用', '云安全评估报告', 'sequential'],
    ],
  ),
}

// ================================================================
//  工作流 6: 供应链攻击模拟
// ================================================================
const RED_TEAM_SUPPLY: WorkflowTemplate = {
  id: 'wf-red-supply',
  name: '🔴 供应链攻击模拟（依赖/CI/CD/仓库）',
  description: '模拟软件供应链攻击路径：依赖混淆 → 恶意包注入 → CI/CD 管道劫持 → 仓库漏洞（GitHub Action/Slack/GitLab Runner）。',
  icon: '⛓️',
  tags: ['red-team', 'supply-chain', 'ci-cd', 'dependency'],
  reference: 'Github-API-scan / dependency-confusion',
  ...buildWorkflow(
    [
      { label: '依赖混淆检测', type: 'data_collection', x: 80, y: 30 },
      { label: 'GitHub 密钥扫描', type: 'data_collection', x: 400, y: 30 },
      { label: 'CI/CD 管道审计', type: 'vulnerability_scan', x: 80, y: 160 },
      { label: '依赖投毒利用', type: 'exploit', x: 80, y: 290 },
      { label: 'CI/CD 管道劫持', type: 'exploit', x: 400, y: 290 },
      { label: 'MCP 仓库扫描', type: 'mcp_tool', x: 240, y: 420 },
      { label: '供应链风险报告', type: 'report', x: 240, y: 550 },
    ],
    [
      ['依赖混淆检测', 'GitHub 密钥扫描', 'parallel'],
      ['GitHub 密钥扫描', 'CI/CD 管道审计', 'sequential'],
      ['依赖混淆检测', '依赖投毒利用', 'sequential'],
      ['CI/CD 管道审计', 'CI/CD 管道劫持', 'sequential'],
      ['依赖投毒利用', 'MCP 仓库扫描', 'sequential'],
      ['CI/CD 管道劫持', 'MCP 仓库扫描', 'sequential'],
      ['MCP 仓库扫描', '供应链风险报告', 'sequential'],
    ],
  ),
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  RED_TEAM_FULL,
  RED_TEAM_WEB,
  RED_TEAM_INTERNAL,
  RED_TEAM_MCP,
  RED_TEAM_CLOUD,
  RED_TEAM_SUPPLY,
]

export function getWorkflowsByTag(tag: string): WorkflowTemplate[] {
  return WORKFLOW_TEMPLATES.filter((w) => w.tags.includes(tag))
}

export function suggestWorkflows(input: string): { template: WorkflowTemplate; score: number }[] {
  const lower = input.toLowerCase()
  return WORKFLOW_TEMPLATES.map((w) => {
    const searchFields = [w.name, w.description, ...w.tags].join(' ').toLowerCase()
    let score = 0
    const keywords = ['sql', 'xss', '内网', '云', 'mcp', 'web', '红队', '渗透', '扫描', 'report',
      '注入', '权限', '横向', '供应链', '域', 'ad', 'aws', 'k8s']
    keywords.forEach((kw) => {
      if (searchFields.includes(kw)) score += 2
    })
    if (lower.length > 2 && w.name.includes(lower)) score += 10
    return { template: w, score }
  }).filter((r) => r.score > 0).sort((a, b) => b.score - a.score)
}
