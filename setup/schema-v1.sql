-- Supabase Query name: platform-schema-v1
-- FC 플랫폼 DB v1 — 별도 Supabase 프로젝트에서 실행 (R37)
-- 정본 가이드: setup/SUPABASE_GUIDE_Platform.md
-- FC 제로 운영 DB(ajcidqsjpkzupxeizbyp)에는 실행하지 마세요.

-- ── 0. 확장 ──
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── 1. 플랫폼 · 회원 (§15) ──

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  platform_id text UNIQUE,
  legal_name text,
  verified_at timestamptz,
  is_beta_founder boolean NOT NULL DEFAULT false,
  pro_paid_until timestamptz,
  pro_billed_owner_clubs int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_platform_id_format CHECK (
    platform_id IS NULL
    OR (
      platform_id ~ '^[a-z][a-z0-9]{3,15}$'
      AND length(platform_id) BETWEEN 4 AND 16
    )
  )
);

CREATE TABLE IF NOT EXISTS public.teams (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id bigint NOT NULL UNIQUE REFERENCES public.teams(id) ON DELETE RESTRICT,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  region text NOT NULL,
  recruiting boolean NOT NULL DEFAULT false,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clubs_slug_format CHECK (slug ~ '^[a-z][a-z0-9-]{2,30}$')
);

CREATE TABLE IF NOT EXISTS public.club_members (
  id bigserial PRIMARY KEY,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'treasurer', 'member')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'left', 'pending')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  UNIQUE (club_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.club_invitations (
  id bigserial PRIMARY KEY,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  invitee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.club_applications (
  id bigserial PRIMARY KEY,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.club_creation_payments (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE RESTRICT,
  amount_won int NOT NULL DEFAULT 2000,
  paid_at timestamptz NOT NULL DEFAULT now(),
  external_ref text
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, created_at DESC)
  WHERE read_at IS NULL AND deleted_at IS NULL;

-- ── 2. 매칭 (§17 MK) ──

CREATE TABLE IF NOT EXISTS public.matching_posts (
  id bigserial PRIMARY KEY,
  host_club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'applications_pending', 'matched', 'cancelled')),
  scheduled_at timestamptz NOT NULL,
  place text NOT NULL,
  region text NOT NULL,
  field_snapshot jsonb NOT NULL,
  roster_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  matched_club_id uuid REFERENCES public.clubs(id),
  matched_application_id bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.matching_applications (
  id bigserial PRIMARY KEY,
  post_id bigint NOT NULL REFERENCES public.matching_posts(id) ON DELETE CASCADE,
  applicant_club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
  field_snapshot jsonb NOT NULL,
  roster_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, applicant_club_id)
);

ALTER TABLE public.matching_posts
  DROP CONSTRAINT IF EXISTS matching_posts_matched_application_fkey;

ALTER TABLE public.matching_posts
  ADD CONSTRAINT matching_posts_matched_application_fkey
  FOREIGN KEY (matched_application_id) REFERENCES public.matching_applications(id)
  DEFERRABLE INITIALLY DEFERRED;

-- ── 3. 구단 홈 데이터 (FC 제로 13테이블 + team_id) ──

CREATE TABLE IF NOT EXISTS public.players (
  id bigint NOT NULL,
  team_id bigint NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  name text NOT NULL,
  jersey int,
  positions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ovr jsonb NOT NULL DEFAULT '{}'::jsonb,
  form_bonus int NOT NULL DEFAULT 0,
  is_mercenary boolean NOT NULL DEFAULT false,
  roster_active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (team_id, id)
);

CREATE TABLE IF NOT EXISTS public.matches (
  id bigint NOT NULL,
  team_id bigint NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  date text,
  opponent text,
  lineup jsonb,
  subs jsonb,
  scorers jsonb,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (team_id, id)
);

CREATE TABLE IF NOT EXISTS public.field (
  team_id bigint NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  id int NOT NULL DEFAULT 1,
  q1tokens jsonb,
  q2tokens jsonb,
  q3tokens jsonb,
  q4tokens jsonb,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (team_id, id),
  CONSTRAINT field_single_row CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS public.saves (
  id bigint NOT NULL,
  team_id bigint NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (team_id, id)
);

CREATE TABLE IF NOT EXISTS public.meta (
  team_id bigint NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  key text NOT NULL,
  value text,
  PRIMARY KEY (team_id, key)
);

CREATE TABLE IF NOT EXISTS public.dues (
  id bigint NOT NULL,
  team_id bigint NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (team_id, id)
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id bigint NOT NULL,
  team_id bigint NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (team_id, id)
);

CREATE TABLE IF NOT EXISTS public.settlements (
  id bigint NOT NULL,
  team_id bigint NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (team_id, id)
);

CREATE TABLE IF NOT EXISTS public.schedules (
  id bigint NOT NULL,
  team_id bigint NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (team_id, id)
);

CREATE TABLE IF NOT EXISTS public.notices (
  id bigint NOT NULL,
  team_id bigint NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (team_id, id)
);

CREATE TABLE IF NOT EXISTS public."dueExemptions" (
  id bigint NOT NULL,
  team_id bigint NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (team_id, id)
);

CREATE TABLE IF NOT EXISTS public."dueMemos" (
  id bigint NOT NULL,
  team_id bigint NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (team_id, id)
);

CREATE TABLE IF NOT EXISTS public.disciplines (
  id bigint NOT NULL,
  team_id bigint NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (team_id, id)
);

-- ── 4. Auth → profiles 자동 생성 ──

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 5. RLS (파일럿: permissive — Go 이후 정책 강화) ──

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_creation_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matching_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matching_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."dueExemptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."dueMemos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disciplines ENABLE ROW LEVEL SECURITY;

-- 파일럿 초기: anon/authenticated 개발용 (운영 전 교체 필수)
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles', 'clubs', 'club_members', 'club_invitations', 'club_applications',
    'club_creation_payments', 'notifications', 'matching_posts', 'matching_applications',
    'players', 'matches', 'field', 'saves', 'meta', 'dues', 'expenses', 'settlements',
    'schedules', 'notices', 'dueExemptions', 'dueMemos', 'disciplines'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "pilot_allow_all" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "pilot_allow_all" ON public.%I FOR ALL USING (true) WITH CHECK (true)',
      t
    );
  END LOOP;
END $$;

-- teams: 내부 테이블 — API 노출 안 함 (가이드 참고)
