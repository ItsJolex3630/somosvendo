import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Send, Trash2, Brain, MessageSquare, X, CheckCircle2, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  clearDoAgentHistory,
  deleteDoAgentMemory,
  fetchDoAgentState,
  postDoAgentChat,
  postDoAgentMemory,
} from '@/lib/vendo/api';
import { useVendo } from './store';
import { toast } from 'sonner';

const QUICK_PROMPTS = [
  '📊 Dame un resumen de cuánto ganamos y gastamos este mes',
  '👥 ¿Cuánto nos ha pagado cada cliente en total?',
  '💸 Registra un gasto único de $10 por recarga urgente de créditos IA',
  '🏷️ Registra un gasto de $25 porque compramos etiquetas NFC',
  '🔁 Registra un gasto fijo de $19 por suscripción de Kimi IA',
];

export function DoMascotAvatar({ size = 34 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 731 1031"
      style={{ width: size, height: size }}
      className="shrink-0 fill-[#f8ffe6] drop-shadow"
      aria-hidden="true"
    >
      <g transform="translate(-156.34 -31.33)">
        <path d="M614.34,536.33c9-11,21-17,33-25,4-3,9-4,13-6,72-33,149-46,227-50-91-21-183-34-276-43-1-10,2-19,5-28,13-46,35-87,61-126-9,14-21,24-31,39-2,2-4,3-6,5a20.92,20.92,0,0,1-4,6c-1,1-2,1-3,2-2,2-2,4-4,6a43.49,43.49,0,0,0-7,6c-6,9-14,13-21,21-1,1-3,1-4,2-1,3-4,3-6,5,0,1-1,1-1,2-4,3-7,4-11,7-1,0-3,1-4,1s-1,2-2,2c-6,2-12,6-18,3-4-1-7-5-10-9a3.67,3.67,0,0,0-1-3c-27-43-32-93-36-141-6-61-5-121,1-181-9,4-13,12-16,20-6,12-9,23-12,36v4c-1,4-2,7-2,11-3,12-4,24-6,37-3,20-2,39-4,59-1,15,1,31-1,46v27c2,29,3,58-2,88-1,5-2,10-6,10-22,3-41-11-60-23-2-1-3-1-5-2-29-20-55-38-79-62,17,38,38,72,60,109,1,2,1,3,2,5,2,3,4,5,6,8,6,12,14,23,21,34-27,14-56,20-87,27-1,0-3,2-4,2a1263.36,1263.36,0,0,1-158,25c65,7,129,11,194,18,18,2,37,2,54,10l3,3c1,2,1,5,1,7,1,48-19,92-35,137a37,37,0,0,0-5,11c24-28,45-57,76-80a100.92,100.92,0,0,1,15-7c7-2,12,4,14,10,2-1,1,2,1,2,34,82,44,168,54,256,2,19,2,37,4,56,1,20,1,39,2,59,1,29-1,59-2,88,27-153,36-308,25-463,20-7,41-1,61,5a389.2,389.2,0,0,1,110,50h2a795.38,795.38,0,0,1-95-89c-1-2-3-4-5-6-2-3-5-6-7-9-3-5-7-9-9-14Z" />
        <path fill="#01160e" d="M490.34,503.33c-12,2-23,4-35,5-4-31-7-61-11-92,12-2,23-3,35-5,3,31,7,61,11,92Z" />
        <path fill="#01160e" d="M574.34,490.33c-12,2-24,3-36,6-4-30-8-61-11-91,12-3,24-3,36-5,2,30,7,60,11,90Z" />
        <path fill="#01160e" d="M496.34,513.33c15-2,29-6,44-7-6,6-11,13-20,15s-17-3-24-8Z" />
      </g>
    </svg>
  );
}

export function DoAdminAssistant() {
  const { doOpen, setDoOpen, refresh } = useVendo();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'chat' | 'memory'>('chat');
  const [input, setInput] = useState('');
  const [newRule, setNewRule] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const agentQuery = useQuery({
    queryKey: ['do_agent_state'],
    queryFn: () => fetchDoAgentState(),
  });

  const chatMutation = useMutation({
    mutationFn: (msg: string) => postDoAgentChat(msg),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['do_agent_state'] });
      if (data.actions && data.actions.length > 0) {
        refresh();
        toast.success(`Do ejecutó ${data.actions.length} acción(es) en Turso DB`);
      }
    },
    onError: (err) => {
      toast.error((err as Error).message || 'Error al comunicarse con Do');
    },
  });

  const addMemoryMutation = useMutation({
    mutationFn: (content: string) => postDoAgentMemory(content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['do_agent_state'] });
      setNewRule('');
      toast.success('Conocimiento guardado en la memoria de Do');
    },
  });

  const deleteMemoryMutation = useMutation({
    mutationFn: (id: string) => deleteDoAgentMemory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['do_agent_state'] });
      toast.success('Regla eliminada de la memoria');
    },
  });

  const clearHistoryMutation = useMutation({
    mutationFn: () => clearDoAgentHistory(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['do_agent_state'] });
      toast.success('Historial de conversación limpiado');
    },
  });

  const messages = agentQuery.data?.messages ?? [];
  const memories = agentQuery.data?.memories ?? [];

  useEffect(() => {
    if (doOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [doOpen, messages.length, chatMutation.isPending]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || chatMutation.isPending) return;
    setInput('');
    await chatMutation.mutateAsync(trimmed);
  };

  const handleChatSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await sendMessage(input);
  };

  const handleRuleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newRule.trim()) return;
    await addMemoryMutation.mutateAsync(newRule.trim());
  };

  return (
    <>
      {/* Botón Flotante de Do en el Panel Admin */}
      <button
        type="button"
        onClick={() => setDoOpen(!doOpen)}
        aria-label="Abrir Agente Do IA"
        className="fixed md:bottom-5 bottom-[calc(68px+env(safe-area-inset-bottom))] right-4 z-50 flex items-center gap-2.5 rounded-full bg-primary px-3.5 py-2.5 text-primary-foreground shadow-xl transition-transform hover:scale-105 active:scale-95 border border-white/20"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#012619]">
          <DoMascotAvatar size={24} />
        </div>
        <div className="text-left pr-1 hidden sm:block">
          <div className="text-xs font-bold leading-none flex items-center gap-1">
            Agente Do <Sparkles size={11} />
          </div>
          <div className="text-[9px] opacity-80 leading-tight mt-0.5">Conectado a Turso DB</div>
        </div>
      </button>

      {/* Drawer Lateral del Agente Do */}
      {doOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
          <aside className="relative flex h-full w-full max-w-md flex-col bg-[#03140d] border-l border-border text-foreground shadow-2xl">
            {/* Cabecera del Agente */}
            <header className="flex items-center justify-between border-b border-border px-4 py-3.5 bg-[#020e09]">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#042f1e] border border-primary/40">
                  <DoMascotAvatar size={32} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold flex items-center gap-1.5">
                    Do · Agente Operativo CRM
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-mono text-primary">
                      <Database size={9} /> Turso Live · Multi-Item NLU
                    </span>
                  </h2>
                  <p className="text-[10px] text-muted-foreground">
                    Acceso total de lectura, análisis y modificación en base de datos
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setDoOpen(false)} aria-label="Cerrar asistente">
                <X size={18} />
              </Button>
            </header>

            {/* Navegación de Pestañas: Chat Operativo vs Memoria & Entrenamiento */}
            <div className="grid grid-cols-2 border-b border-border bg-[#020e09]/60 px-4 py-2 gap-2">
              <button
                type="button"
                onClick={() => setTab('chat')}
                className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-all ${
                  tab === 'chat' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <MessageSquare size={13} /> Chat & Acciones
              </button>
              <button
                type="button"
                onClick={() => setTab('memory')}
                className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-all ${
                  tab === 'memory' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Brain size={13} /> Memoria ({memories.length})
              </button>
            </div>

            {tab === 'chat' ? (
              <>
                {/* Cuerpo de Mensajes */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Mensaje de Bienvenida Fijo */}
                  <div className="rounded-xl bg-[#062116] border border-primary/25 p-3.5 text-xs space-y-2">
                    <p className="font-medium text-primary flex items-center gap-1.5">
                      <Sparkles size={13} /> ¡Hola! Soy Do, tu trabajador inteligente dentro del CRM.
                    </p>
                    <p className="text-muted-foreground leading-relaxed text-[11px]">
                      Tengo acceso completo en tiempo real a todos los clientes, ingresos, gastos y cobros en Turso DB. Pídeme que consulte datos o que registre pagos, gastos únicos (ej. créditos IA), suscripciones o nuevos clientes.
                    </p>
                    <div className="pt-1 flex flex-wrap gap-1.5">
                      {QUICK_PROMPTS.map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => sendMessage(q)}
                          className="text-left text-[10px] px-2.5 py-1 rounded-lg bg-[#03140d] border border-border hover:border-primary/60 text-foreground transition-colors"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Historial desde Turso DB */}
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs whitespace-pre-wrap leading-relaxed ${
                          m.role === 'user'
                            ? 'bg-primary text-primary-foreground rounded-br-xs font-medium'
                            : 'bg-card border border-border text-foreground rounded-bl-xs'
                        }`}
                      >
                        {m.content}
                      </div>
                      {m.actions && m.actions.length > 0 && (
                        <div className="mt-1.5 flex flex-col gap-1 max-w-[88%]">
                          {m.actions.map((act, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-1.5 rounded-md bg-primary/15 border border-primary/30 px-2.5 py-1 text-[10px] text-primary font-mono"
                            >
                              <CheckCircle2 size={11} /> {act.label}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {chatMutation.isPending && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
                      <DoMascotAvatar size={20} /> Do está consultando y actualizando Turso DB...
                    </div>
                  )}
                </div>

                {/* Barra Inferior de Entrada */}
                <footer className="border-t border-border p-3 bg-[#020e09]">
                  <form onSubmit={handleChatSubmit} className="flex gap-2">
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Ej. Registra un gasto de $10 por créditos IA..."
                      className="text-xs h-10"
                    />
                    <Button type="submit" size="icon" className="h-10 w-10 shrink-0" disabled={chatMutation.isPending}>
                      <Send size={15} />
                    </Button>
                  </form>
                  {messages.length > 0 && (
                    <div className="mt-2 flex justify-between items-center text-[10px] text-muted-foreground">
                      <span>Todo cambio se guarda en vivo en Turso DB</span>
                      <button
                        type="button"
                        onClick={() => clearHistoryMutation.mutate()}
                        className="hover:text-destructive flex items-center gap-1"
                      >
                        <Trash2 size={10} /> Limpiar chat
                      </button>
                    </div>
                  )}
                </footer>
              </>
            ) : (
              /* Pestaña de Memoria & Auto-Entrenamiento de Do */
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="rounded-xl bg-[#062116] border border-primary/25 p-3.5 text-xs space-y-1.5">
                  <h3 className="font-semibold text-primary flex items-center gap-1.5">
                    <Brain size={14} /> Base de Conocimiento & Reglas de Do
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Enseña a Do precios fijos, acuerdos con socios, costos de insumos o reglas de VENDO. También puedes enseñarle directamente en el chat diciéndole <em>"Recuerda que..."</em>.
                  </p>
                </div>

                <form onSubmit={handleRuleSubmit} className="space-y-2">
                  <Input
                    value={newRule}
                    onChange={(e) => setNewRule(e.target.value)}
                    placeholder="Ej. La suscripción de Kimi cuesta $19/mes y se paga los días 5..."
                    className="text-xs"
                  />
                  <Button type="submit" size="sm" className="w-full" disabled={addMemoryMutation.isPending}>
                    + Guardar conocimiento en la memoria de Do
                  </Button>
                </form>

                <div className="space-y-2 pt-2">
                  <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Reglas aprendidas en Turso DB ({memories.length})
                  </h4>
                  {memories.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-6 text-center border border-dashed border-border rounded-lg">
                      Do aún no tiene reglas personalizadas guardadas. ¡Añade la primera arriba!
                    </p>
                  ) : (
                    memories.map((mem) => (
                      <div
                        key={mem.id}
                        className="flex items-start justify-between gap-2 rounded-lg border border-border bg-card p-3 text-xs"
                      >
                        <p className="leading-relaxed">{mem.content}</p>
                        <button
                          type="button"
                          onClick={() => deleteMemoryMutation.mutate(mem.id)}
                          className="text-muted-foreground hover:text-destructive shrink-0 mt-0.5"
                          title="Eliminar regla"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
