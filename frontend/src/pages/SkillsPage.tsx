import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { SkillGrid } from '@/components/skills/SkillGrid'
import { UploadSkillDialog, type ParsedSkill } from '@/components/skills/UploadSkillDialog'
import { Search, Upload, Filter, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { loadBuiltinSkills } from '@/lib/loadSkills'
import { notify } from '@/lib/notifications'
import type { Skill, SkillCategory } from '@/types/skill'
import api from '@/lib/api'

const MOCK_SKILLS: Skill[] = [
  { id: 'mock-1', name: 'nmap_scan', display_name: 'Nmap 端口扫描', description: '使用 Nmap 进行全面的端口扫描和服务识别', long_description: '', category: 'reconnaissance', severity: 'low', status: 'active', icon: 'Search', author: 'VulnFlow', version: '1.2.0', parameters: [], dependencies: [], estimated_time: 120, risk_level: 'low', tags: ['nmap', 'scan'], usage_count: 1534, success_rate: 98.5, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-06-01T00:00:00Z' },
  { id: 'mock-2', name: 'subdomain_enum', display_name: '子域名枚举', description: '使用多个数据源和字典进行子域名暴力枚举', long_description: '', category: 'reconnaissance', severity: 'low', status: 'active', icon: 'Search', author: 'VulnFlow', version: '1.5.0', parameters: [], dependencies: [], estimated_time: 180, risk_level: 'low', tags: ['subdomain', 'dns'], usage_count: 892, success_rate: 94.2, created_at: '2024-02-01T00:00:00Z', updated_at: '2024-06-15T00:00:00Z' },
  { id: 'mock-3', name: 'sql_injection', display_name: 'SQL 注入检测', description: '自动化检测和利用 SQL 注入漏洞', long_description: '', category: 'web_application', severity: 'critical', status: 'active', icon: 'Globe', author: 'VulnFlow', version: '2.1.0', parameters: [], dependencies: [], estimated_time: 60, risk_level: 'high', tags: ['sql', 'injection'], usage_count: 2341, success_rate: 87.3, created_at: '2024-01-15T00:00:00Z', updated_at: '2024-07-01T00:00:00Z' },
  { id: 'mock-4', name: 'xss_scanner', display_name: 'XSS 漏洞扫描', description: '检测反射型、存储型和 DOM 型 XSS 漏洞', long_description: '', category: 'web_application', severity: 'high', status: 'active', icon: 'Globe', author: 'VulnFlow', version: '1.8.0', parameters: [], dependencies: [], estimated_time: 45, risk_level: 'medium', tags: ['xss', 'web'], usage_count: 1892, success_rate: 91.2, created_at: '2024-02-01T00:00:00Z', updated_at: '2024-07-10T00:00:00Z' },
  { id: 'mock-5', name: 'dir_bruteforce', display_name: '目录爆破', description: '多线程目录和文件暴力枚举', long_description: '', category: 'reconnaissance', severity: 'low', status: 'active', icon: 'Search', author: 'VulnFlow', version: '1.3.0', parameters: [], dependencies: [], estimated_time: 300, risk_level: 'low', tags: ['directory'], usage_count: 987, success_rate: 76.8, created_at: '2024-03-01T00:00:00Z', updated_at: '2024-06-20T00:00:00Z' },
  { id: 'mock-6', name: 'metasploit_exploit', display_name: 'Metasploit 利用', description: '使用 Metasploit 框架进行自动化攻击链', long_description: '', category: 'exploitation', severity: 'critical', status: 'active', icon: 'Terminal', author: 'VulnFlow', version: '1.8.0', parameters: [], dependencies: ['nmap_scan'], estimated_time: 180, risk_level: 'high', tags: ['metasploit'], usage_count: 654, success_rate: 72.4, created_at: '2024-03-15T00:00:00Z', updated_at: '2024-07-05T00:00:00Z' },
  { id: 'mock-7', name: 'wifi_crack', display_name: 'WiFi 安全审计', description: '无线网络密码破解和安全审计', long_description: '', category: 'wireless', severity: 'medium', status: 'active', icon: 'Wifi', author: 'VulnFlow', version: '1.1.0', parameters: [], dependencies: [], estimated_time: 600, risk_level: 'medium', tags: ['wifi'], usage_count: 432, success_rate: 65.0, created_at: '2024-04-01T00:00:00Z', updated_at: '2024-06-25T00:00:00Z' },
  { id: 'mock-8', name: 'aws_audit', display_name: 'AWS 安全审计', description: '检查 AWS 云环境的安全配置', long_description: '', category: 'cloud', severity: 'high', status: 'active', icon: 'Cloud', author: 'VulnFlow', version: '1.4.0', parameters: [], dependencies: [], estimated_time: 240, risk_level: 'low', tags: ['aws'], usage_count: 321, success_rate: 89.1, created_at: '2024-04-15T00:00:00Z', updated_at: '2024-07-12T00:00:00Z' },
]

// 从 API 返回的对象映射到 UI Skill 类型
function apiSkillToSkill(item: any): Skill {
  return {
    id: item.id,
    name: item.name,
    display_name: item.display_name,
    description: item.description || '',
    long_description: '',
    category: item.category || 'custom',
    severity: item.severity || 'medium',
    status: item.is_enabled !== false ? 'active' : 'deprecated',
    icon: 'Code',
    author: item.author || 'unknown',
    version: item.version || '1.0.0',
    parameters: [],
    dependencies: [],
    estimated_time: item.estimated_time || 60,
    risk_level: item.risk_level || item.severity || 'medium',
    tags: item.tags || [],
    usage_count: item.usage_count || 0,
    success_rate: item.success_rate || 0,
    created_at: item.created_at || new Date().toISOString(),
    updated_at: item.updated_at || new Date().toISOString(),
  }
}

const CATEGORY_TABS = [
  { key: 'all' as SkillCategory | 'all', label: '全部' },
  { key: 'reconnaissance' as SkillCategory, label: '侦察' },
  { key: 'web_application' as SkillCategory, label: '漏洞检测' },
  { key: 'exploitation' as SkillCategory, label: '漏洞利用' },
  { key: 'post_exploitation' as SkillCategory, label: '后渗透' },
  { key: 'reporting' as SkillCategory, label: '工具' },
]

export function SkillsPage() {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<SkillCategory | 'all'>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [apiSkills, setApiSkills] = useState<Skill[]>([])      // 后端 API 技能
  const [builtinSkills, setBuiltinSkills] = useState<Skill[]>([]) // public/skills/ 文件技能
  const [useApi, setUseApi] = useState(true)                     // 是否使用 API

  // 加载 API 技能 + 内置技能
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      // 加载 public/skills/ 下的技能（fallback）
      try {
        const parsed = await loadBuiltinSkills()
        if (!cancelled) {
          setBuiltinSkills(parsed.map((p, i) => ({
            id: `builtin-${i}`,
            name: p.name,
            display_name: p.display_name || p.name,
            description: p.description || '',
            long_description: p.long_description || '',
            category: p.category as SkillCategory || 'custom',
            severity: p.severity || 'medium',
            status: 'active' as const,
            icon: p.icon || 'Code',
            author: p.author || 'unknown',
            version: p.version || '1.0.0',
            parameters: [], dependencies: [],
            estimated_time: p.estimated_time || 60,
            risk_level: p.risk_level || p.severity || 'medium',
            tags: p.tags || [],
            usage_count: 0, success_rate: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })))
        }
      } catch { /* no built-in skills */ }

      // 从后端 API 加载技能
      try {
        const res = await api.get('/skills', { params: { page_size: 200 } })
        const data = res.data
        const items = Array.isArray(data) ? data : data?.items || []
        if (!cancelled) {
          if (items.length === 0) {
            // 数据库为空，自动导入内置技能
            try {
              await api.post('/skills/import-builtin')
              const res2 = await api.get('/skills', { params: { page_size: 200 } })
              const data2 = res2.data
              const items2 = Array.isArray(data2) ? data2 : data2?.items || []
              setApiSkills(items2.map(apiSkillToSkill))
            } catch { /* import failed */ }
          } else {
            setApiSkills(items.map(apiSkillToSkill))
          }
          setUseApi(true)
        }
      } catch (err) {
        // API 不可用 → 用本地数据
        if (!cancelled) setUseApi(false)
      }
      if (!cancelled) setIsLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [])

  // 最终技能列表
  const allSkills = useMemo(() => {
    if (useApi && apiSkills.length > 0) {
      return apiSkills
    }
    return [...builtinSkills, ...MOCK_SKILLS]
  }, [useApi, apiSkills, builtinSkills])

  const filteredSkills = useMemo(() => {
    return allSkills.filter((s) => {
      const ms = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.display_name.toLowerCase().includes(search.toLowerCase())
      const mc = selectedCategory === 'all' || s.category === selectedCategory
      return ms && mc
    })
  }, [allSkills, search, selectedCategory])

  const handleUpload = useCallback(async (parsed: ParsedSkill[]) => {
    if (useApi) {
      // 通过 API 上传
      for (const p of parsed) {
        try {
          const blob = new Blob([`---\nname: ${p.name}\ndisplay_name: ${p.display_name}\ndescription: ${p.description}\ncategory: ${p.category}\nseverity: ${p.severity}\nauthor: ${p.author}\nversion: ${p.version}\ntags: [${(p.tags || []).join(', ')}]\n---\n\n${p.description}`], { type: 'text/markdown' })
          const form = new FormData()
          form.append('file', blob, `${p.name}.md`)
          await api.post('/skills/upload', form)
        } catch (e: any) {
          toast.error(`上传 ${p.name} 失败: ${e?.response?.data?.detail || e.message}`)
          return
        }
      }
      // 刷新列表
      const res = await api.get('/skills', { params: { page_size: 200 } })
      setApiSkills((res.data?.items || res.data || []).map(apiSkillToSkill))
      toast.success(`上传 ${parsed.length} 个技能成功`)
      notify.success('技能上传完成', `成功上传 ${parsed.length} 个技能`, { target: '技能市场' })
    } else {
      // 本地模式：略（用旧的 mock 方式）
      toast.success(`已解析 ${parsed.length} 个技能（演示模式，后端不可用）`)
    }
  }, [useApi])

  const handleDelete = useCallback(async (id: string) => {
    if (id.startsWith('mock-') || id.startsWith('builtin-')) {
      toast.error('预设技能无法删除')
      return
    }
    if (useApi) {
      try {
        await api.delete(`/skills/${id}`)
        setApiSkills((prev) => prev.filter((s) => s.id !== id))
        toast.success('已删除')
      } catch { toast.error('删除失败') }
    }
  }, [useApi])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">技能市场</h1>
          <p className="text-sm text-[#94a3b8] mt-1">
            {useApi ? '后端驱动 · 数据持久化' : '本地模式 · 修改不会持久化'}
          </p>
        </div>
      </div>

      {/* Search & Upload */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索技能名称..."
            className="pl-9 bg-[#111827] border-[#1e293b] text-[#e2e8f0] placeholder:text-[#64748b] h-10 rounded-xl focus:border-cyber-cyan/50"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSelectedCategory(tab.key)}
              className={cn(
                'whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                selectedCategory === tab.key
                  ? 'bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/20 shadow-[0_0_10px_rgba(0,212,170,0.05)]'
                  : 'bg-[#111827] text-[#94a3b8] hover:text-white border border-[#1e293b]',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <p className="text-sm text-[#94a3b8]">
            共 <span className="text-cyber-cyan font-medium">{filteredSkills.length}</span> 个技能
          </p>
          <Button
            className="bg-cyber-cyan hover:bg-cyber-cyan/90 text-black text-xs h-9 rounded-lg shadow-[0_0_10px_rgba(0,212,170,0.2)]"
            onClick={() => setUploadOpen(true)}
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            上传技能
          </Button>
        </div>
      </div>

      {/* Skill grid */}
      <SkillGrid
        skills={filteredSkills}
        isLoading={isLoading}
        onDelete={useApi ? handleDelete : undefined}
      />

      {/* Upload Dialog */}
      <UploadSkillDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSubmit={handleUpload}
      />
    </div>
  )
}
