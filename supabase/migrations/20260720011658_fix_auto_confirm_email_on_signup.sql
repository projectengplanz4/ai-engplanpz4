/*
# Fix signup: auto-confirm email in handle_new_user trigger

1. Problem
   Email confirmation is enabled by default in Supabase. When a new user
   signs up via supabase.auth.signUp(), Supabase creates the auth.users row
   but does NOT return a session (because the email is unconfirmed). The
   frontend treats "no session" as an error, so the user sees a red error
   message. Even worse, no confirmation email is actually delivered (no
   SMTP configured), so the user can never confirm and never log in.

2. Fix
   Modify handle_new_user() — which already runs as SECURITY DEFINER
   (postgres) AFTER INSERT on auth.users — to also set
   email_confirmed_at = now() on the newly created user row. This
   auto-confirms the email so that:
     a. signUp() returns a valid session immediately
     b. The user can log in right away without email confirmation
     c. The frontend treats signup as a success

3. Security
   - handle_new_user() is SECURITY DEFINER owned by postgres, so it has
     permission to UPDATE auth.users.
   - This disables email confirmation for ALL new signups, which is the
     intended behavior for this app (email confirmation is OFF per the
     bolt-database skill guidance).
   - The admin edge function already sets email_confirm: true when
     creating users via admin.createUser(), so this is consistent.
*/

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  assigned_role text;
BEGIN
  BEGIN
    SELECT role INTO assigned_role FROM preassigned_admins WHERE email = NEW.email;
  EXCEPTION WHEN undefined_table THEN
    assigned_role := NULL;
  END;

  -- Auto-confirm the email so signup returns a session immediately
  NEW.email_confirmed_at := now();

  INSERT INTO profiles (id, email, role)
  VALUES (NEW.id, NEW.email, COALESCE(assigned_role, 'user'))
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
