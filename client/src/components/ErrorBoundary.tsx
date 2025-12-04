import { Component, ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean; error?: any; info?: any }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }
  static getDerivedStateFromError(error: any) { return { hasError: true, error } }
  componentDidCatch(error: any, info: any) { console.error('Runtime error:', error, info); this.setState({ info }) }
  render() {
    if (this.state.hasError) {
      const msg = String(this.state.error?.message || this.state.error || 'Unknown error')
      const stack = String(this.state.error?.stack || '')
      const comp = String(this.state.info?.componentStack || '')
      return (
        <div style={{ padding: 16 }}>
          <div style={{ background: '#fee2e2', color: '#7f1d1d', padding: 12, borderRadius: 8, border: '1px solid #fca5a5' }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Error</div>
            <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>{msg}</div>
            {stack && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Stack</div>
                <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', fontSize: 12 }}>{stack}</div>
              </div>
            )}
            {comp && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Component Stack</div>
                <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', fontSize: 12 }}>{comp}</div>
              </div>
            )}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
