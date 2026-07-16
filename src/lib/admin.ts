import { env } from './env';
import { supabase } from './supabase';

export interface AdminUser {
  id: string;
  email: string;
  role: 'user' | 'admin';
  created_at: string;
}

async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sesi tidak ditemukan. Silakan masuk kembali.');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    apikey: env.VITE_SUPABASE_ANON_KEY,
  };
}

function baseUrl() {
  return `${env.VITE_SUPABASE_URL}/functions/v1/admin-users`;
}

export async function listUsers(): Promise<AdminUser[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(baseUrl(), { headers, method: 'GET' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Gagal memuat daftar user (${res.status})`);
  }
  const data = await res.json();
  return data.users as AdminUser[];
}

export async function changeUserRole(targetUserId: string, newRole: 'user' | 'admin'): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${baseUrl()}?action=change-role`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ targetUserId, newRole }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Gagal mengubah role (${res.status})`);
  }
}

export async function deleteUser(targetUserId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(baseUrl(), {
    method: 'DELETE',
    headers,
    body: JSON.stringify({ targetUserId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Gagal menghapus user (${res.status})`);
  }
}
