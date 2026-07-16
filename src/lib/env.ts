// Centralized env access with validation. Fails loudly if a required var is missing.

interface Env {
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
  VITE_OLLAMA_BASE_URL: string;
}

function getEnv(): Env {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  const ollamaUrl = import.meta.env.VITE_OLLAMA_BASE_URL as string | undefined;

  const missing: string[] = [];
  if (!url) missing.push('VITE_SUPABASE_URL');
  if (!anonKey) missing.push('VITE_SUPABASE_ANON_KEY');
  if (!ollamaUrl) missing.push('VITE_OLLAMA_BASE_URL');

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        'Please set them in your .env file.',
    );
  }

  return {
    VITE_SUPABASE_URL: url!,
    VITE_SUPABASE_ANON_KEY: anonKey!,
    VITE_OLLAMA_BASE_URL: ollamaUrl!.replace(/\/$/, ''),
  };
}

export const env = getEnv();
