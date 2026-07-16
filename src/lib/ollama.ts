import { env } from './env';

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaModelInfo {
  name: string;
  size?: number;
  details?: { family: string; parameter_size: string };
}

const MODEL = 'qwen2.5:7b';

/**
 * Stream a chat completion from the local Ollama instance.
 * Calls onToken for each text chunk as it arrives.
 * Returns the full accumulated text when done.
 */
export async function streamChat(
  messages: OllamaMessage[],
  onToken: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(`${env.VITE_OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, messages, stream: true }),
    signal,
  });

  if (!res.ok) {
    throw new Error(`Ollama responded with status ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body from Ollama');

  const decoder = new TextDecoder();
  let full = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const json = JSON.parse(trimmed);
        if (json.message?.content) {
          full += json.message.content;
          onToken(json.message.content);
        }
        if (json.done) return full;
      } catch {
        // partial JSON, skip
      }
    }
  }

  return full;
}

/** Check if the Ollama service is reachable. */
export async function checkOllama(): Promise<boolean> {
  try {
    const res = await fetch(`${env.VITE_OLLAMA_BASE_URL}/api/tags`, {
      method: 'GET',
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** List available models from Ollama. */
export async function listModels(): Promise<OllamaModelInfo[]> {
  const res = await fetch(`${env.VITE_OLLAMA_BASE_URL}/api/tags`);
  if (!res.ok) throw new Error(`Failed to list models: ${res.status}`);
  const data = await res.json();
  return (data.models ?? []) as OllamaModelInfo[];
}
