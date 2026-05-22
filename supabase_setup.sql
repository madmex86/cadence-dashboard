-- ====================================================================
-- SUPABASE SETUP: ROW-LEVEL SECURITY & PROFILE SYNCHRONIZATION
-- Run this script in the Supabase SQL Editor (https://supabase.com)
-- to resolve the empty admin settings registry and secure access.
-- ====================================================================

-- 1. Ensure the public.profiles table has Row Level Security enabled (which it does)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Clean up any stale policies to avoid conflicts
DROP POLICY IF EXISTS "Allow select for everyone" ON public.profiles;
DROP POLICY IF EXISTS "Allow insert for self" ON public.profiles;
DROP POLICY IF EXISTS "Allow update for self or admin" ON public.profiles;
DROP POLICY IF EXISTS "Allow delete for admin" ON public.profiles;

-- 3. Create SECURE and ROBUST Row-Level Security policies:

-- Policy A: Allow anyone to read profiles (needed for middleware and admin page to render the list)
CREATE POLICY "Allow select for everyone" ON public.profiles
  FOR SELECT USING (true);

-- Policy B: Allow authenticated users to insert their own profile on login/sync
-- Prevents regular users from elevating themselves to 'admin' at creation time
CREATE POLICY "Allow insert for self" ON public.profiles
  FOR INSERT WITH CHECK (
    auth.uid() = id AND (
      role = 'user' OR
      (role = 'admin' AND auth.jwt() ->> 'email' = 'stevenportugal86@gmail.com')
    )
  );

-- Policy C: Allow users to update their own display name, or the owner (admin) to update anyone's role
CREATE POLICY "Allow update for self or admin" ON public.profiles
  FOR UPDATE USING (
    auth.uid() = id OR 
    auth.jwt() ->> 'email' = 'stevenportugal86@gmail.com'
  );

-- Policy D: Allow only the owner (admin) to delete profiles
CREATE POLICY "Allow delete for admin" ON public.profiles
  FOR DELETE USING (
    auth.jwt() ->> 'email' = 'stevenportugal86@gmail.com'
  );


-- 4. Create an automatic Auth Signup Trigger:
-- This automatically copies future signups from auth.users into public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    CASE WHEN new.email = 'stevenportugal86@gmail.com' THEN 'admin' ELSE 'user' END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind the trigger function to run after any new user is added in auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 5. RUN A ONE-TIME SYNC OF ALL EXISTING AUTH USERS:
-- Since the profiles table is currently empty, this will copy all previously
-- signed up users into the public registry immediately so you don't have to wait.
INSERT INTO public.profiles (id, email, full_name, role)
SELECT 
  id, 
  email, 
  COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
  CASE WHEN email = 'stevenportugal86@gmail.com' THEN 'admin' ELSE 'user' END
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Verification query: inspect your synced team profiles!
SELECT * FROM public.profiles ORDER BY email;


-- ====================================================================
-- 6. ADDITIONAL INTERNAL TABLES ROW-LEVEL SECURITY & POLICIES
-- Add RLS and explicit read/write access for authenticated administrators
-- ====================================================================

-- A. Table: public.settings
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select for authenticated" ON public.settings;
CREATE POLICY "Allow select for authenticated" ON public.settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow write for authenticated" ON public.settings;
CREATE POLICY "Allow write for authenticated" ON public.settings FOR ALL TO authenticated USING (true);

-- B. Table: public.site_settings
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select for everyone" ON public.site_settings;
CREATE POLICY "Allow select for everyone" ON public.site_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow write for authenticated" ON public.site_settings;
CREATE POLICY "Allow write for authenticated" ON public.site_settings FOR ALL TO authenticated USING (true);

-- C. Table: public.creatures
ALTER TABLE public.creatures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select for everyone" ON public.creatures;
CREATE POLICY "Allow select for everyone" ON public.creatures FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow write for authenticated" ON public.creatures;
CREATE POLICY "Allow write for authenticated" ON public.creatures FOR ALL TO authenticated USING (true);

-- D. Table: public.inventory
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select for authenticated" ON public.inventory;
CREATE POLICY "Allow select for authenticated" ON public.inventory FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow write for authenticated" ON public.inventory;
CREATE POLICY "Allow write for authenticated" ON public.inventory FOR ALL TO authenticated USING (true);

-- E. Table: public.orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select for authenticated" ON public.orders;
CREATE POLICY "Allow select for authenticated" ON public.orders FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow write for authenticated" ON public.orders;
CREATE POLICY "Allow write for authenticated" ON public.orders FOR ALL TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow insert for everyone" ON public.orders;
CREATE POLICY "Allow insert for everyone" ON public.orders FOR INSERT WITH CHECK (true);

-- F. Table: public.finance
ALTER TABLE public.finance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select for authenticated" ON public.finance;
CREATE POLICY "Allow select for authenticated" ON public.finance FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow write for authenticated" ON public.finance;
CREATE POLICY "Allow write for authenticated" ON public.finance FOR ALL TO authenticated USING (true);

-- G. Table: public.printers
ALTER TABLE public.printers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select for authenticated" ON public.printers;
CREATE POLICY "Allow select for authenticated" ON public.printers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow write for authenticated" ON public.printers;
CREATE POLICY "Allow write for authenticated" ON public.printers FOR ALL TO authenticated USING (true);

-- H. Table: public.email_templates
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select for authenticated" ON public.email_templates;
CREATE POLICY "Allow select for authenticated" ON public.email_templates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow write for authenticated" ON public.email_templates;
CREATE POLICY "Allow write for authenticated" ON public.email_templates FOR ALL TO authenticated USING (true);

-- I. Table: public.mileage
ALTER TABLE public.mileage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select for authenticated" ON public.mileage;
CREATE POLICY "Allow select for authenticated" ON public.mileage FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow write for authenticated" ON public.mileage;
CREATE POLICY "Allow write for authenticated" ON public.mileage FOR ALL TO authenticated USING (true);

-- J. Table: public.faqs
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select for everyone" ON public.faqs;
CREATE POLICY "Allow select for everyone" ON public.faqs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow write for authenticated" ON public.faqs;
CREATE POLICY "Allow write for authenticated" ON public.faqs FOR ALL TO authenticated USING (true);

-- K. Table: public.reviews
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select for everyone" ON public.reviews;
CREATE POLICY "Allow select for everyone" ON public.reviews FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert for everyone" ON public.reviews;
CREATE POLICY "Allow insert for everyone" ON public.reviews FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow write for authenticated" ON public.reviews;
CREATE POLICY "Allow write for authenticated" ON public.reviews FOR ALL TO authenticated USING (true);

-- L. Table: public.contact_submissions
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select for authenticated" ON public.contact_submissions;
CREATE POLICY "Allow select for authenticated" ON public.contact_submissions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow insert for everyone" ON public.contact_submissions;
CREATE POLICY "Allow insert for everyone" ON public.contact_submissions FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow write for authenticated" ON public.contact_submissions;
CREATE POLICY "Allow write for authenticated" ON public.contact_submissions FOR ALL TO authenticated USING (true);

-- M. Table: public.subscribers
ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select for authenticated" ON public.subscribers;
CREATE POLICY "Allow select for authenticated" ON public.subscribers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow insert for everyone" ON public.subscribers;
CREATE POLICY "Allow insert for everyone" ON public.subscribers FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow write for authenticated" ON public.subscribers;
CREATE POLICY "Allow write for authenticated" ON public.subscribers FOR ALL TO authenticated USING (true);

