export type View =
  | { kind: 'task'; id: string; title: string; status: string; note: string }
  | { kind: 'summary'; open: number; waiting: number }

declare module 'claude-code' {
  interface PluginState {
    'shu-bar': { view: View | null }
  }
}
