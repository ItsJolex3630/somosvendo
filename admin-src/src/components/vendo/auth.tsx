// Puerta de autenticación del panel (Google Sign-In) + contexto de sesión.
// Replica el flujo del admin anterior: GSI -> credential JWT -> sessionStorage,
// y 401/403 desde la API -> volver al acceso.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  clearSession,
  decodeEmail,
  getGoogleClientId,
  getStoredEmail,
  getToken,
  storeSession,
} from '@/lib/vendo/api';

type AuthValue = {
  token: string | null;
  email: string;
  ready: boolean;
  forbidden: boolean;
  error: string;
  signOut: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}

const GSI_SRC = 'https://accounts.google.com/gsi/client';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string>('');
  const [ready, setReady] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState('');

  // La sesión se lee en un efecto (no en el inicializador) para que el primer
  // render del cliente coincida con el del servidor y no haya hydration mismatch.
  useEffect(() => {
    setToken(getToken());
    setEmail(getStoredEmail());
    setReady(true);
  }, []);

  const signOut = useCallback(() => {
    clearSession();
    setToken(null);
    setEmail('');
    setForbidden(false);
    setReady(true);
    queryClient.clear();
    try {
      const g = (window as unknown as { google?: { accounts?: { id?: { disableAutoSelect?: () => void } } } }).google;
      g?.accounts?.id?.disableAutoSelect?.();
    } catch {
      /* noop */
    }
  }, [queryClient]);

  const handleCredential = useCallback((credential: string) => {
    const mail = decodeEmail(credential);
    storeSession(credential, mail);
    setToken(credential);
    setEmail(mail);
    setForbidden(false);
    setError('');
  }, []);

  useEffect(() => {
    function onUnauthorized(e: Event) {
      const detail = (e as CustomEvent<{ status?: number; error?: string }>).detail || {};
      if (detail.status === 403) {
        setForbidden(true);
        setError(detail.error || 'Esta cuenta no tiene acceso al panel.');
      } else {
        signOut();
        setError('Tu sesión expiró. Inicia sesión de nuevo.');
      }
    }
    window.addEventListener('vendo:unauthorized', onUnauthorized);
    return () => window.removeEventListener('vendo:unauthorized', onUnauthorized);
  }, [signOut]);

  useEffect(() => {
    if (!ready || token) return;
    let cancelled = false;
    const mount = (clientId: string) => {
      if (cancelled) return;
      const g = (window as unknown as {
        google?: {
          accounts?: {
            id?: {
              initialize: (opts: unknown) => void;
              renderButton: (el: HTMLElement | null, opts: unknown) => void;
            };
          };
        };
      }).google;
      const id = g?.accounts?.id;
      if (!id) return;
      id.initialize({
        client_id: clientId,
        callback: (res: { credential?: string }) => {
          if (res?.credential) handleCredential(res.credential);
        },
      });
      id.renderButton(document.getElementById('gsi-slot'), {
        theme: 'filled_black',
        size: 'large',
        shape: 'pill',
        text: 'signin_with',
        logo_alignment: 'left',
        width: 300,
      });
      setReady(true);
    };
    (async () => {
      const clientId = await getGoogleClientId();
      if (cancelled) return;
      if (!clientId) {
        setError('No se pudo obtener la configuración de Google.');
        setReady(true);
        return;
      }
      const g = (window as unknown as { google?: { accounts?: { id?: unknown } } }).google;
      if (g?.accounts?.id) {
        mount(clientId);
        return;
      }
      const existing = document.querySelector(`script[src="${GSI_SRC}"]`);
      if (existing) {
        existing.addEventListener('load', () => mount(clientId));
        return;
      }
      const script = document.createElement('script');
      script.src = GSI_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => mount(clientId);
      script.onerror = () => {
        setError('No se pudo cargar Google Sign-In. Revisa tu conexión.');
        setReady(true);
      };
      document.head.appendChild(script);
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, token, handleCredential]);

  return (
    <AuthContext.Provider value={{ token, email, ready, forbidden, error, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { token, forbidden, ready, error, signOut } = useAuth();
  if (!ready) return <Splash />;
  if (token && !forbidden) return <>{children}</>;
  if (token && forbidden) return <AccessDenied message={error} onSignOut={signOut} />;
  return <LoginScreen ready={ready} error={error} />;
}

function Splash() {
  return (
    <div className="auth-screen">
      <div className="auth-card auth-card--splash">
        <div className="auth-mark">V</div>
        <div className="auth-spinner" aria-label="Cargando" />
      </div>
    </div>
  );
}

function LoginScreen({ ready, error }: { ready: boolean; error: string }) {
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-mark">V</div>
        <h1>Panel VENDO</h1>
        <p className="auth-sub">Tesorería y relaciones comerciales. Acceso exclusivo para administradores.</p>
        <div className="gsi-slot" id="gsi-slot">{!ready && <span className="auth-hint">Cargando acceso seguro…</span>}</div>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <p className="auth-foot">Usa una cuenta de administrador autorizada.</p>
      </div>
    </div>
  );
}

function AccessDenied({ message, onSignOut }: { message: string; onSignOut: () => void }) {
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-mark">V</div>
        <h1>Sin acceso</h1>
        <p className="auth-sub">{message || 'Esta cuenta de Google no está autorizada para el panel.'}</p>
        <button type="button" className="auth-button" onClick={onSignOut}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
