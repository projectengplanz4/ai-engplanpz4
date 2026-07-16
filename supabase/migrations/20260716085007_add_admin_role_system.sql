/*
# Add profiles table with role system + admin assignment

1. Overview
   Introduces a role system (user/admin) via a `profiles` table that mirrors
   auth.users. A trigger automatically creates a profile row whenever a new
   user signs up, defaulting to role = 'user'. The designated admin email
   (projectengplanz4@gmail.com) is granted the 'admin' role.

2. New Tables
   - profiles:
     - id (uuid, primary key, references auth.users)
     - email (text, not null)
     - role (text, not null, default 'user') — 'user' or 'admin'
     - created_at (timestamptz, default now())
     - updated_at (timestamptz, default now())

3. Functions & Triggers
   - handle_new_user(): trigger function that inserts a profile row on signup.
   - on_auth_user_created: AFTER INSERT trigger on auth.users.

4. Security
   - RLS enabled on profiles.
   - Users can read their own profile (SELECT, auth.uid() = id).
   - Admins can read all profiles (SELECT, role check via EXISTS subquery).
   - Users can update their own profile (UPDATE, auth.uid() = id) — but NOT
     the role column (guarded by a separate trigger that prevents non-admins
     from changing role).
   - Admins can update any profile (UPDATE, role check).
   - No direct DELETE from profiles — handled by cascade when auth.users row
     is deleted via the admin edge function.

5. Admin Assignment
   - After creating the table and trigger, an UPDATE sets role = 'admin' for
     the profile matching projectengplanz4@gmail.com. If the user hasn't signed
     up yet, a placeholder insert is created so the role is ready when they do.
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

-- Admins can read all profiles
DROP POLICY IF EXISTS "admin_select_all_profiles" ON profiles;
CREATE POLICY "admin_select_all_profiles" ON profiles FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Users can update their own profile (but role is protected by trigger)
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Admins can update any profile
DROP POLICY IF EXISTS "admin_update_all_profiles" ON profiles;
CREATE POLICY "admin_update_all_profiles" ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Trigger: auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'user')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Trigger: prevent non-admins from changing role
CREATE OR REPLACE FUNCTION protect_profile_role()
RETURNS trigger AS $$
BEGIN
  -- Only allow role changes if the current user is an admin
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Hanya admin yang dapat mengubah role';
    END IF;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS protect_profile_role_trigger ON profiles;
CREATE TRIGGER protect_profile_role_trigger
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_profile_role();

-- Assign admin role to projectengplanz4@gmail.com
-- If the user already exists in auth.users, update their profile.
-- If not yet signed up, create a placeholder profile so the role is ready.
DO $$
BEGIN
  -- Try to find existing auth user
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'projectengplanz4@gmail.com') THEN
    INSERT INTO profiles (id, email, role)
    SELECT id, email, 'admin' FROM auth.users WHERE email = 'projectengplanz4@gmail.com'
    ON CONFLICT (id) DO UPDATE SET role = 'admin';
  ELSE
    -- Create a placeholder profile with a generated UUID
    -- The trigger will handle the real insert on signup, but we set admin
    -- via a separate mechanism: we'll use a temporary table to track
    -- pre-assigned admin emails
    CREATE TABLE IF NOT EXISTS preassigned_admins (
      email text PRIMARY KEY,
      role text NOT NULL DEFAULT 'admin',
      assigned_at timestamptz DEFAULT now()
    );
    INSERT INTO preassigned_admins (email, role)
    VALUES ('projectengplanz4@gmail.com', 'admin')
    ON CONFLICT (email) DO NOTHING;
  END IF;
END $$;

-- Update the handle_new_user trigger to check preassigned_admins
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  assigned_role text;
BEGIN
  SELECT role INTO assigned_role FROM preassigned_admins WHERE email = NEW.email;
  INSERT INTO profiles (id, email, role)
  VALUES (NEW.id, NEW.email, COALESCE(assigned_role, 'user'))
  ON CONFLICT (id) DO UPDATE SET role = COALESCE(assigned_role, profiles.role);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
