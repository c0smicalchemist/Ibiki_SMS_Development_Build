import { Component, ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean; error?: any }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }
  static getDerivedStateFromError(error: any) { return { hasError: true, error } }
  componentDidCatch(error: any) { console.error('Runtime error:', error) }
  render() {
    if (this.state.hasError) {
      const msg = String(this.state.error?.message || this.state.error || 'Unknown error')
      return (
        <div style={{ padding: 16 }}>
          <div style={{ background: '#fee2e2', color: '#7f1d1d', padding: 12, borderRadius: 8, border: '1px solid #fca5a5' }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Error</div>
            <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>{msg}</div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
