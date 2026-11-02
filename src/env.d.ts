/// <reference types="vite/client" />

interface Window {
  utools?: {
    onPluginEnter(callback: (action: { code: string }) => void): void
    setSubInput(callback: (input: { text: string }) => void, placeholder: string, focus?: boolean): void
    isDarkColors?(): boolean
    registerTool?(name: string, handler: (params: Record<string, unknown>) => unknown): void
  }
}
