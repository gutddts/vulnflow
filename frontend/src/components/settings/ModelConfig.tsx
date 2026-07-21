import { useState, useEffect } from 'react'
import { Cpu, Globe, Key, Eye, EyeOff, Zap, CheckCircle2, Loader2, AlertCircle, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useSettingsStore, type ApiFormat } from '@/stores/settingsStore'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface ModelConfigProps {
  className?: string
}

// API 格式：openai（OpenAI 风格）/ anthropic（Anthropic 风格）
type ApiFormat = 'openai' | 'anthropic'

// 不同 provider 的 API 格式与默认 base URL
const PROVIDER_API_CONFIG: Record<string, { formats: ApiFormat[]; defaultOpenAI: string; defaultAnthropic?: string }> = {
  openai: {
    formats: ['openai'],
    defaultOpenAI: 'https://api.openai.com/v1',
  },
  deepseek: {
    formats: ['openai', 'anthropic'],
    defaultOpenAI: 'https://api.deepseek.com',
    defaultAnthropic: 'https://api.deepseek.com/anthropic',
  },
  ollama: {
    formats: ['openai'],
    defaultOpenAI: 'http://localhost:11434',
  },
  vllm: {
    formats: ['openai'],
    defaultOpenAI: 'http://localhost:8000/v1',
  },
  anthropic: {
    formats: ['anthropic'],
    defaultOpenAI: 'https://api.anthropic.com',
    defaultAnthropic: 'https://api.anthropic.com',
  },
}

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI', models: ['gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'] },
  { value: 'deepseek', label: 'DeepSeek', models: ['deepseek-v3', 'deepseek-r1', 'deepseek-coder', 'deepseek-v4-flash', 'deepseek-v4-pro'] },
  { value: 'ollama', label: 'Ollama', models: ['llama3', 'mistral', 'codellama', 'qwen2'] },
  { value: 'vllm', label: 'vLLM', models: ['custom'] },
  { value: 'anthropic', label: 'Anthropic', models: ['claude-3-opus', 'claude-3.5-sonnet', 'claude-3-haiku'] },
]

export function ModelConfig({ className }: ModelConfigProps) {
  // 从 settingsStore 读取已保存的配置
  const storeConfig = useSettingsStore()
  const [provider, setProvider] = useState(storeConfig.provider || 'deepseek')
  const [apiFormat, setApiFormat] = useState<ApiFormat>((storeConfig.apiFormat as ApiFormat) || 'openai')
  const [model, setModel] = useState(storeConfig.model || 'deepseek-v4-pro')
  const [apiBaseUrl, setApiBaseUrl] = useState(storeConfig.apiBaseUrl || 'https://api.deepseek.com')
  const [apiKey, setApiKey] = useState(storeConfig.apiKeys[storeConfig.provider] || '')
  const [showKey, setShowKey] = useState(false)
  const [temperature, setTemperature] = useState(storeConfig.temperature ?? 0.7)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'failed' | null>(null)

  // 本地模型设置
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434')
  const [ollamaModel, setOllamaModel] = useState('llama3')

  const currentProvider = PROVIDERS.find((p) => p.value === provider)
  const providerApiConfig = PROVIDER_API_CONFIG[provider]
  const availableFormats = providerApiConfig?.formats || ['openai']

  // 切换 provider 时，重置 model 和 base URL
  useEffect(() => {
    if (currentProvider && !currentProvider.models.includes(model)) {
      setModel(currentProvider.models[0])
    }
    if (providerApiConfig) {
      const newBase = apiFormat === 'anthropic' && providerApiConfig.defaultAnthropic
        ? providerApiConfig.defaultAnthropic
        : providerApiConfig.defaultOpenAI
      setApiBaseUrl(newBase)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider])

  // 切换 API 格式时更新 base URL
  const handleFormatChange = (fmt: ApiFormat) => {
    setApiFormat(fmt)
    if (providerApiConfig) {
      const newBase = fmt === 'anthropic' && providerApiConfig.defaultAnthropic
        ? providerApiConfig.defaultAnthropic
        : providerApiConfig.defaultOpenAI
      setApiBaseUrl(newBase)
    }
  }

  // 保存配置到 settingsStore（持久化到 localStorage，AI 对话处读取）
  const handleSaveConfig = () => {
    storeConfig.setAiConfig({
      provider,
      model,
      apiBaseUrl,
      apiFormat,
      apiKey,
      temperature,
      maxTokens: storeConfig.maxTokens,
    })
    toast.success('AI 模型配置已保存', {
      description: `${provider} · ${model} · ${apiBaseUrl}`,
    })
  }

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    // 先保存配置
    handleSaveConfig()
    try {
      // 根据 API 格式决定端点和请求格式
      // 保留原路径（如 /anthropic），只去掉末尾 /
      const baseUrl = apiBaseUrl.replace(/\/$/, '')
      const isAnthropic = apiFormat === 'anthropic'
      const url = isAnthropic ? `${baseUrl}/messages` : `${baseUrl}/chat/completions`

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      const body: Record<string, unknown> = { model, max_tokens: 5 }

      if (isAnthropic) {
        headers['x-api-key'] = apiKey
        headers['anthropic-version'] = '2023-06-01'
        body.messages = [{ role: 'user', content: 'ping' }]
      } else {
        headers['Authorization'] = `Bearer ${apiKey}`
        body.messages = [{ role: 'user', content: 'ping' }]
      }

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })

      if (res.ok) {
        setTestResult('success')
      } else {
        // 读取错误信息以便调试
        const errText = await res.text().catch(() => '')
        console.warn(`测试连接 ${res.status}: ${errText.slice(0, 200)}`)
        setTestResult('failed')
      }
    } catch (err) {
      console.error('测试连接失败:', err)
      setTestResult('failed')
    }
    setTesting(false)
    setTimeout(() => setTestResult(null), 5000)
  }

  const handleCopyKey = () => {
    navigator.clipboard.writeText(apiKey)
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* AI Model Configuration */}
      <div className="rounded-xl border border-[#1e293b] bg-[#1a1f2e] p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#7c3aed]/10 border border-[#7c3aed]/20">
            <Cpu className="h-5 w-5 text-[#7c3aed]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">AI 模型配置</h2>
            <p className="text-xs text-[#94a3b8]">配置 AI 模型提供商和连接参数</p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Provider select */}
          <div>
            <label className="text-sm font-medium text-[#e2e8f0] mb-2 block">模型提供商</label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setProvider(p.value)}
                  className={cn(
                    'rounded-lg border px-3 py-2.5 text-xs font-medium transition-all text-center',
                    provider === p.value
                      ? 'bg-cyber-cyan/10 text-cyber-cyan border-cyber-cyan/30 shadow-[0_0_10px_rgba(0,212,170,0.1)]'
                      : 'bg-[#111827] text-[#94a3b8] border-[#1e293b] hover:text-white hover:border-[#334155]',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Model name */}
          <div>
            <label className="text-sm font-medium text-[#e2e8f0] mb-2 block">模型名称</label>
            {currentProvider && currentProvider.models[0] !== 'custom' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {currentProvider.models.map((m) => (
                  <button
                    key={m}
                    onClick={() => setModel(m)}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-xs font-medium transition-all text-left',
                      model === m
                        ? 'bg-[#7c3aed]/10 text-[#7c3aed] border-[#7c3aed]/30'
                        : 'bg-[#111827] text-[#94a3b8] border-[#1e293b] hover:text-white',
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            ) : (
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="输入模型名称..."
                className="bg-[#111827] border-[#1e293b] text-[#e2e8f0] placeholder:text-[#64748b] h-10 rounded-xl focus:border-cyber-cyan/50"
              />
            )}
          </div>

          {/* API Base URL */}
          <div>
            <label className="text-sm font-medium text-[#e2e8f0] mb-2 block">API 基础地址</label>

            {/* API 格式切换（如果当前 provider 支持多格式） */}
            {availableFormats.length > 1 && (
              <div className="mb-2 flex items-center gap-2 text-xs">
                <span className="text-[#64748b]">支持方式：</span>
                {availableFormats.map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => handleFormatChange(fmt)}
                    className={cn(
                      'rounded-md px-2.5 py-1 border transition-all',
                      apiFormat === fmt
                        ? 'bg-cyber-cyan/10 text-cyber-cyan border-cyber-cyan/30'
                        : 'bg-[#111827] text-[#94a3b8] border-[#1e293b] hover:text-white',
                    )}
                  >
                    {fmt === 'openai' ? 'OpenAI 格式' : 'Anthropic 格式'}
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748b]" />
                <Input
                  value={apiBaseUrl}
                  onChange={(e) => setApiBaseUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="pl-10 bg-[#111827] border-[#1e293b] text-[#e2e8f0] placeholder:text-[#64748b] h-10 rounded-xl focus:border-cyber-cyan/50"
                />
              </div>
            </div>
            <p className="text-[10px] text-[#64748b] mt-1.5 font-mono">
              当前格式：{apiFormat === 'openai' ? 'OpenAI 格式' : 'Anthropic 格式'} · {provider === 'deepseek' && apiFormat === 'openai' && 'https://api.deepseek.com'}
              {provider === 'deepseek' && apiFormat === 'anthropic' && 'https://api.deepseek.com/anthropic'}
            </p>
          </div>

          {/* API Key */}
          <div>
            <label className="text-sm font-medium text-[#e2e8f0] mb-2 block">API 密钥</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748b]" />
                <Input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="pl-10 pr-10 bg-[#111827] border-[#1e293b] text-[#e2e8f0] placeholder:text-[#64748b] h-10 rounded-xl focus:border-cyber-cyan/50"
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-white"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyKey}
                className="border-[#1e293b] bg-[#111827] text-[#94a3b8] hover:text-white h-10"
              >
                复制
              </Button>
            </div>
          </div>

          {/* Test Connection + Save */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={testing || !apiKey}
              className="border-[#1e293b] bg-[#111827] text-[#e2e8f0] hover:bg-[#1a1f2e] rounded-xl"
            >
              {testing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  测试中...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-1.5" />
                  测试连接
                </>
              )}
            </Button>
            <Button
              onClick={handleSaveConfig}
              className="bg-cyber-cyan hover:bg-cyber-cyan/90 text-black rounded-xl shadow-[0_0_10px_rgba(0,212,170,0.2)]"
            >
              <Save className="h-4 w-4 mr-1.5" />
              保存配置
            </Button>
            {testResult === 'success' && (
              <div className="flex items-center gap-1.5 text-green-400 text-sm">
                <CheckCircle2 className="h-4 w-4" />
                <span>连接成功</span>
              </div>
            )}
            {testResult === 'failed' && (
              <div className="flex items-center gap-1.5 text-red-400 text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>连接失败</span>
              </div>
            )}
          </div>

          {/* Temperature slider */}
          <div>
            <label className="text-sm font-medium text-[#e2e8f0] mb-2 block">
              温度 ({temperature})
            </label>
            <div className="space-y-2">
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-cyber-cyan h-2 rounded-lg appearance-none bg-[#1e293b] cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #00d4aa 0%, #00d4aa ${temperature * 50}%, #1e293b ${temperature * 50}%, #1e293b 100%)`,
                }}
              />
              <div className="flex justify-between text-xs text-[#64748b]">
                <span>精确 (0)</span>
                <span className={cn(
                  temperature <= 0.5 ? 'text-blue-400' :
                  temperature <= 1.0 ? 'text-cyber-cyan' :
                  temperature <= 1.5 ? 'text-yellow-400' : 'text-red-400',
                )}>
                  {temperature <= 0.5 ? '精确' :
                   temperature <= 1.0 ? '平衡' :
                   temperature <= 1.5 ? '创意' : '随机'}
                </span>
                <span>随机 (2)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Local Model (Ollama) */}
      <div className="rounded-xl border border-[#1e293b] bg-[#1a1f2e] p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10 border border-green-500/20">
            <Cpu className="h-5 w-5 text-green-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">本地模型 (Ollama)</h2>
            <p className="text-xs text-[#94a3b8]">配置本地运行的 Ollama 模型服务</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-[#e2e8f0] mb-2 block">Ollama 地址</label>
              <Input
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                placeholder="http://localhost:11434"
                className="bg-[#111827] border-[#1e293b] text-[#e2e8f0] placeholder:text-[#64748b] h-10 rounded-xl focus:border-cyber-cyan/50"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[#e2e8f0] mb-2 block">本地模型</label>
              <Input
                value={ollamaModel}
                onChange={(e) => setOllamaModel(e.target.value)}
                placeholder="llama3"
                className="bg-[#111827] border-[#1e293b] text-[#e2e8f0] placeholder:text-[#64748b] h-10 rounded-xl focus:border-cyber-cyan/50"
              />
            </div>
          </div>
          <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-400" />
              <span className="text-xs text-green-400 font-medium">本地服务状态</span>
            </div>
            <p className="text-[10px] text-[#64748b] mt-1">
              连接本地 Ollama 服务以使用开源模型，数据不会离开本地环境
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
