import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

// Red de seguridad: si cualquier vista lanza un error de render, se muestra un
// mensaje accionable en lugar de una pantalla en blanco.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[vendo] error de render:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="auth-screen">
          <div className="auth-card">
            <div className="auth-mark">V</div>
            <h1>Algo salió mal</h1>
            <p className="auth-sub">
              {this.state.error.message || 'Ocurrió un error inesperado al cargar el panel.'}
            </p>
            <button
              type="button"
              className="auth-button"
              onClick={() => {
                this.setState({ error: null });
                if (typeof window !== 'undefined') window.location.reload();
              }}
            >
              Recargar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
