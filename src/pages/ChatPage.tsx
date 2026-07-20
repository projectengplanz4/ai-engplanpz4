import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Plus,
  Send,
  Trash2,
  Paperclip,
  MessageSquare,
  Loader2,
  FileText,
  X,
  Pencil,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { streamChat, checkOllama, type OllamaMessage } from '../lib/ollama';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
}

interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface DocOption {
  id: string;
  filename: string;
  parsed_content: string;
  content_kind: 'text' | 'markdown';
}

export function ChatPage() {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState('');
  const [ollamaOnline, setOllamaOnline] = useState<boolean | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showDocPicker, setShowDocPicker] = useState(false);
  const [docs, setDocs] = useState<DocOption[]>([]);
  const [attachedDoc, setAttachedDoc] = useState<DocOption | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load sessions
  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('id, title, created_at')
      .order('created_at', { ascending: false });
    if (error) {
      toast('Gagal memuat sesi chat', 'error');
    } else {
      setSessions(data ?? []);
      if (data && data.length > 0 && !activeSession) {
        setActiveSession(data[0].id);
      }
    }
    setLoadingSessions(false);
  }, [toast, activeSession]);

  // Load messages for active session
  const loadMessages = useCallback(async (sessionId: string) => {
    setLoadingMessages(true);
    const { data, error } = await supabase
      .from('chat_messages')
      .select('id, session_id, role, content, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
    if (error) {
      toast('Gagal memuat pesan', 'error');
    } else {
      setMessages(data ?? []);
    }
    setLoadingMessages(false);
  }, [toast]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (activeSession) loadMessages(activeSession);
    else setMessages([]);
  }, [activeSession, loadMessages]);

  useEffect(() => {
    checkOllama().then(setOllamaOnline);
  }, []);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streamContent]);

  const createSession = async () => {
    const title = `Chat ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`;
    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({ title })
      .select('id, title, created_at')
      .single();
    if (error) {
      toast('Gagal membuat sesi', 'error');
      return;
    }
    setSessions((prev) => [data, ...prev]);
    setActiveSession(data.id);
    setMessages([]);
  };

  const deleteSession = async (id: string) => {
    const { error } = await supabase.from('chat_sessions').delete().eq('id', id);
    if (error) {
      toast('Gagal menghapus sesi', 'error');
      return;
    }
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeSession === id) {
      setActiveSession(null);
      setMessages([]);
    }
    setDeleteConfirm(null);
    toast('Sesi dihapus', 'success');
  };

  const renameSession = async (id: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    const { error } = await supabase.from('chat_sessions').update({ title: newTitle.trim() }).eq('id', id);
    if (error) {
      toast('Gagal mengganti nama', 'error');
      return;
    }
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, title: newTitle.trim() } : s)));
    setEditingSessionId(null);
  };

  const loadDocs = async () => {
    const { data, error } = await supabase
      .from('documents')
      .select('id, filename, parsed_content, content_kind')
      .order('created_at', { ascending: false });
    if (error) {
      toast('Gagal memuat dokumen', 'error');
      return;
    }
    setDocs(data ?? []);
  };

  const sendMessage = async () => {
    if (!input.trim() || streaming) return;

    let sessionId = activeSession;
    if (!sessionId) {
      const title = `Chat ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`;
      const { data, error } = await supabase
        .from('chat_sessions')
        .insert({ title })
        .select('id, title, created_at')
        .single();
      if (error || !data) {
        toast('Gagal membuat sesi', 'error');
        return;
      }
      sessionId = data.id;
      setSessions((prev) => [data, ...prev]);
      setActiveSession(data.id);
    }

    const userText = input.trim();
    setInput('');

    // Build context with attached document
    const contextMessages: OllamaMessage[] = [];
    if (attachedDoc) {
      const contextPrefix =
        attachedDoc.content_kind === 'markdown'
          ? 'Berikut adalah data dari dokumen Excel dalam format tabel Markdown:\n\n'
          : 'Berikut adalah konten dari dokumen yang diunggah:\n\n';
      contextMessages.push({
        role: 'system',
        content: `${contextPrefix}${attachedDoc.parsed_content}\n\nGunakan informasi di atas untuk menjawab pertanyaan pengguna.`,
      });
    }

    // Build conversation history from existing messages
    for (const msg of messages) {
      contextMessages.push({ role: msg.role, content: msg.content });
    }
    contextMessages.push({ role: 'user', content: userText });

    // Save user message to DB
    const { data: savedUserMsg } = await supabase
      .from('chat_messages')
      .insert({ session_id: sessionId, role: 'user', content: userText })
      .select('id, session_id, role, content, created_at')
      .single();

    if (savedUserMsg) {
      setMessages((prev) => [...prev, savedUserMsg]);
    }

    // Start streaming
    setStreaming(true);
    setStreamContent('');
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let full = '';
      await streamChat(contextMessages, (chunk) => {
        full += chunk;
        setStreamContent(full);
      }, controller.signal);

      // Save assistant message
      const { data: savedAssistantMsg } = await supabase
        .from('chat_messages')
        .insert({ session_id: sessionId, role: 'assistant', content: full })
        .select('id, session_id, role, content, created_at')
        .single();

      if (savedAssistantMsg) {
        setMessages((prev) => [...prev, savedAssistantMsg]);
      }
    } catch (err) {
      if (controller.signal.aborted) {
        // Save partial response
        const partial = streamContent || '[Dibatalkan]';
        const { data: savedPartial } = await supabase
          .from('chat_messages')
          .insert({ session_id: sessionId, role: 'assistant', content: partial })
          .select('id, session_id, role, content, created_at')
          .single();
        if (savedPartial) {
          setMessages((prev) => [...prev, savedPartial]);
        }
      } else {
        toast('Gagal menghubungi Ollama. Pastikan service berjalan.', 'error');
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            session_id: sessionId!,
            role: 'assistant',
            content: 'Maaf, terjadi kesalahan saat menghubungi AI. Pastikan Ollama berjalan di alamat yang dikonfigurasi.',
            created_at: new Date().toISOString(),
          } as ChatMessage,
        ]);
      }
    } finally {
      setStreaming(false);
      setStreamContent('');
      abortRef.current = null;
      setAttachedDoc(null);
    }
  };

  const stopStreaming = () => {
    abortRef.current?.abort();
  };

  return (
    <div className="flex h-screen lg:h-screen">
      {/* Session sidebar */}
      <div className="hidden md:flex w-72 flex-col border-r border-slate-200 bg-white">
        <div className="p-4 border-b border-slate-200">
          <Button onClick={createSession} className="w-full" size="md">
            <Plus className="w-4 h-4" />
            Sesi Baru
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin px-2 py-2">
          {loadingSessions ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8 px-4">
              Belum ada sesi. Mulai chat baru.
            </p>
          ) : (
            sessions.map((s) => (
              <div
                key={s.id}
                className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors mb-0.5 ${
                  activeSession === s.id ? 'bg-teal-50 text-teal-900' : 'hover:bg-slate-50 text-slate-700'
                }`}
                onClick={() => setActiveSession(s.id)}
              >
                <MessageSquare className="w-4 h-4 shrink-0 opacity-50" />
                {editingSessionId === s.id ? (
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={() => renameSession(s.id, editTitle)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') renameSession(s.id, editTitle);
                      if (e.key === 'Escape') setEditingSessionId(null);
                    }}
                    className="flex-1 text-sm bg-white border border-teal-300 rounded px-1.5 py-0.5 focus:outline-none"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="flex-1 text-sm truncate">{s.title}</span>
                )}
                <div className="hidden group-hover:flex items-center gap-0.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingSessionId(s.id);
                      setEditTitle(s.title);
                    }}
                    className="p-1 rounded text-slate-400 hover:text-teal-600"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirm(s.id);
                    }}
                    className="p-1 rounded text-slate-400 hover:text-rose-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Ollama status banner */}
        {ollamaOnline === false && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center gap-2 text-sm text-amber-800">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            Ollama tidak terdeteksi. Pastikan service berjalan dan VITE_OLLAMA_BASE_URL sudah benar.
          </div>
        )}

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin">
          {!activeSession && messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6">
              <div className="w-16 h-16 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Mulai percakapan</h2>
              <p className="text-slate-500 max-w-md">
                Buat sesi baru dan mulai chat dengan AI. Anda bisa melampirkan dokumen sebagai konteks.
              </p>
            </div>
          ) : messages.length === 0 && !loadingMessages ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6">
              <p className="text-slate-500">Ketik pesan di bawah untuk memulai.</p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
              {loadingMessages && (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                </div>
              )}
              {messages.map((msg) => (
                <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
              ))}
              {streaming && streamContent && (
                <MessageBubble role="assistant" content={streamContent} streaming />
              )}
              {streaming && !streamContent && (
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  AI sedang berpikir...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-slate-200 bg-white px-4 py-3">
          {attachedDoc && (
            <div className="max-w-3xl mx-auto mb-2 flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
              <FileText className="w-4 h-4 text-teal-600 shrink-0" />
              <span className="text-sm text-teal-800 truncate flex-1">{attachedDoc.filename}</span>
              <button onClick={() => setAttachedDoc(null)} className="text-teal-600 hover:text-teal-800">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className="max-w-3xl mx-auto flex items-end gap-2">
            <button
              onClick={() => {
                loadDocs();
                setShowDocPicker(true);
              }}
              className="p-2.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors shrink-0"
              title="Lampirkan dokumen"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Ketik pesan... (Enter untuk kirim, Shift+Enter untuk baris baru)"
              rows={1}
              className="flex-1 resize-none rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 max-h-32"
              style={{ minHeight: '42px' }}
              disabled={streaming}
            />
            {streaming ? (
              <Button variant="danger" onClick={stopStreaming} className="shrink-0">
                <X className="w-4 h-4" />
                Stop
              </Button>
            ) : (
              <Button onClick={sendMessage} disabled={!input.trim()} className="shrink-0">
                <Send className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Document picker modal */}
      <Modal
        open={showDocPicker}
        onClose={() => setShowDocPicker(false)}
        title="Pilih Dokumen sebagai Konteks"
        size="md"
      >
        {docs.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">
            Belum ada dokumen. Unggah dokumen di halaman Dokumen terlebih dahulu.
          </p>
        ) : (
          <div className="space-y-2">
            {docs.map((d) => (
              <button
                key={d.id}
                onClick={() => {
                  setAttachedDoc(d);
                  setShowDocPicker(false);
                  toast('Dokumen dilampirkan sebagai konteks', 'success');
                }}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-teal-300 hover:bg-teal-50/50 transition-all text-left"
              >
                <FileText className="w-5 h-5 text-slate-400 shrink-0" />
                <span className="text-sm font-medium text-slate-700 truncate">{d.filename}</span>
                <span className="text-xs text-slate-400 ml-auto">
                  {d.content_kind === 'markdown' ? 'Tabel MD' : 'Teks'}
                </span>
              </button>
            ))}
          </div>
        )}
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Hapus Sesi?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
              Batal
            </Button>
            <Button variant="danger" onClick={() => deleteSession(deleteConfirm!)}>
              <Trash2 className="w-4 h-4" />
              Hapus
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Sesi dan semua pesan di dalamnya akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
        </p>
      </Modal>
    </div>
  );
}

function MessageBubble({ role, content, streaming }: { role: 'user' | 'assistant'; content: string; streaming?: boolean }) {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-teal-600 text-white rounded-br-md'
            : 'bg-white border border-slate-200 text-slate-800 rounded-bl-md'
        }`}
      >
        <div className={`text-sm leading-relaxed whitespace-pre-wrap ${streaming ? 'after:content-["▋"] after:animate-pulse' : ''}`}>
          {content}
        </div>
      </div>
    </div>
  );
}
