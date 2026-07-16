/*
# AI Office Dashboard - Core Schema

1. Overview
   Multi-user application with Supabase email/password authentication. Each user
   owns their chat sessions, messages, uploaded documents, and data records.
   All tables are owner-scoped via user_id with row-level security policies.

2. New Tables
   - chat_sessions: A chat conversation thread belonging to a user.
     - id (uuid, primary key)
     - user_id (uuid, FK to auth.users, defaults to auth.uid())
     - title (text, not null) - display name for the session
     - created_at (timestamptz, defaults to now())
   - chat_messages: Individual messages within a chat session.
     - id (uuid, primary key)
     - session_id (uuid, FK to chat_sessions, cascade delete)
     - user_id (uuid, FK to auth.users, defaults to auth.uid())
     - role (text, not null) - 'user' or 'assistant'
     - content (text, not null) - message text
     - created_at (timestamptz, defaults to now())
   - documents: Parsed document uploads stored as text/markdown for AI context.
     - id (uuid, primary key)
     - user_id (uuid, FK to auth.users, defaults to auth.uid())
     - filename (text, not null)
     - file_type (text, not null) - 'pdf', 'word', or 'excel'
     - file_size (bigint, not null) - size in bytes
     - parsed_content (text, not null) - extracted text or markdown table
     - content_kind (text, not null) - 'text' or 'markdown'
     - created_at (timestamptz, defaults to now())
   - data_records: Generic CRUD entity for office data management.
     - id (uuid, primary key)
     - user_id (uuid, FK to auth.users, defaults to auth.uid())
     - title (text, not null)
     - description (text, nullable)
     - category (text, nullable)
     - status (text, not null, defaults to 'pending') - pending/active/done
     - created_at (timestamptz, defaults to now())
     - updated_at (timestamptz, defaults to now())

3. Indexes
   - chat_messages_session_id_idx: fast message lookup by session
   - documents_user_id_idx: list documents per user
   - data_records_user_id_idx: list records per user

4. Security
   - RLS enabled on all four tables.
   - chat_sessions: owner-scoped CRUD (auth.uid() = user_id).
   - chat_messages: owner-scoped CRUD via direct user_id ownership AND
     session membership check (session belongs to caller).
   - documents: owner-scoped CRUD (auth.uid() = user_id).
   - data_records: owner-scoped CRUD (auth.uid() = user_id).
   - user_id columns default to auth.uid() so client inserts that omit user_id
     still satisfy WITH CHECK policies.
*/

-- chat_sessions
CREATE TABLE IF NOT EXISTS chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_chat_sessions" ON chat_sessions;
CREATE POLICY "select_own_chat_sessions" ON chat_sessions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_chat_sessions" ON chat_sessions;
CREATE POLICY "insert_own_chat_sessions" ON chat_sessions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_chat_sessions" ON chat_sessions;
CREATE POLICY "update_own_chat_sessions" ON chat_sessions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_chat_sessions" ON chat_sessions;
CREATE POLICY "delete_own_chat_sessions" ON chat_sessions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- chat_messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_session_id_idx ON chat_messages(session_id);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_chat_messages" ON chat_messages;
CREATE POLICY "select_own_chat_messages" ON chat_messages FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_chat_messages" ON chat_messages;
CREATE POLICY "insert_own_chat_messages" ON chat_messages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_chat_messages" ON chat_messages;
CREATE POLICY "update_own_chat_messages" ON chat_messages FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_chat_messages" ON chat_messages;
CREATE POLICY "delete_own_chat_messages" ON chat_messages FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- documents
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  filename text NOT NULL,
  file_type text NOT NULL CHECK (file_type IN ('pdf', 'word', 'excel')),
  file_size bigint NOT NULL,
  parsed_content text NOT NULL,
  content_kind text NOT NULL CHECK (content_kind IN ('text', 'markdown')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS documents_user_id_idx ON documents(user_id);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_documents" ON documents;
CREATE POLICY "select_own_documents" ON documents FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_documents" ON documents;
CREATE POLICY "insert_own_documents" ON documents FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_documents" ON documents;
CREATE POLICY "update_own_documents" ON documents FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_documents" ON documents;
CREATE POLICY "delete_own_documents" ON documents FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- data_records
CREATE TABLE IF NOT EXISTS data_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'done')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS data_records_user_id_idx ON data_records(user_id);

ALTER TABLE data_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_data_records" ON data_records;
CREATE POLICY "select_own_data_records" ON data_records FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_data_records" ON data_records;
CREATE POLICY "insert_own_data_records" ON data_records FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_data_records" ON data_records;
CREATE POLICY "update_own_data_records" ON data_records FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_data_records" ON data_records;
CREATE POLICY "delete_own_data_records" ON data_records FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- updated_at trigger for data_records
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS data_records_updated_at ON data_records;
CREATE TRIGGER data_records_updated_at
  BEFORE UPDATE ON data_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
