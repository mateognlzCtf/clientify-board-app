-- ============================================================
-- CLIENTIFY BOARD — DATABASE SCHEMA
-- Ejecuta este archivo completo en: Supabase → SQL Editor
-- ============================================================


-- ============================================================
-- 1. TABLAS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT,
  avatar_url  TEXT,
  status      TEXT NOT NULL DEFAULT 'active',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  key         TEXT NOT NULL UNIQUE,
  description TEXT,
  owner_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.project_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'member'
                CHECK (role IN ('owner', 'admin', 'member')),
  invited_by  UUID REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.issue_sequences (
  project_id   UUID PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  last_number  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.sprints (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  goal        TEXT,
  start_date  DATE,
  end_date    DATE,
  status      TEXT NOT NULL DEFAULT 'planned',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.epics (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#6366f1',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.project_statuses (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  color                 TEXT,
  position              INTEGER NOT NULL DEFAULT 0,
  requires_pause_reason BOOLEAN NOT NULL DEFAULT false,
  is_completed          BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.project_issue_types (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.project_labels (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#6b7280',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.issues (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  key          TEXT NOT NULL,
  title        TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'To Do',
  priority     TEXT NOT NULL DEFAULT 'medium',
  type         TEXT NOT NULL DEFAULT 'task',
  assignee_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reporter_id  UUID NOT NULL REFERENCES public.profiles(id),
  position     FLOAT NOT NULL DEFAULT 0,
  due_date     DATE,
  start_date   DATE,
  sprint_id    UUID REFERENCES public.sprints(id) ON DELETE SET NULL,
  epic_id      UUID REFERENCES public.epics(id) ON DELETE SET NULL,
  slack_thread TEXT,
  pause_reason TEXT,
  resolved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, key)
);

CREATE TABLE IF NOT EXISTS public.issue_labels (
  issue_id   UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  label_id   UUID NOT NULL REFERENCES public.project_labels(id) ON DELETE CASCADE,
  PRIMARY KEY (issue_id, label_id)
);

CREATE TABLE IF NOT EXISTS public.issue_links (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_issue_id  UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  target_issue_id  UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  created_by       UUID NOT NULL REFERENCES public.profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id    UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content     JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.attachments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id     UUID REFERENCES public.issues(id) ON DELETE CASCADE,
  comment_id   UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  uploaded_by  UUID NOT NULL REFERENCES public.profiles(id),
  file_name    TEXT NOT NULL,
  file_path    TEXT NOT NULL,
  file_size    INTEGER NOT NULL,
  mime_type    TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pending_invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'member',
  token       TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  invited_by  UUID NOT NULL REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + interval '7 days',
  accepted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.admin_action_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token           TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  action          TEXT NOT NULL,
  target_user_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + interval '7 days',
  used_at         TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.platform_invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  token       TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  invited_by  UUID NOT NULL REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + interval '7 days',
  accepted_at TIMESTAMPTZ
);


-- ============================================================
-- 2. FUNCIONES Y TRIGGERS
-- ============================================================

-- updated_at automático
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER set_updated_at_projects
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER set_updated_at_sprints
  BEFORE UPDATE ON public.sprints
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER set_updated_at_epics
  BEFORE UPDATE ON public.epics
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER set_updated_at_issues
  BEFORE UPDATE ON public.issues
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER set_updated_at_comments
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Crear perfil al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, status)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url',
    'active'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Agregar owner y crear secuencia al crear un proyecto
CREATE OR REPLACE FUNCTION public.handle_new_project()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner');

  INSERT INTO public.issue_sequences (project_id, last_number)
  VALUES (NEW.id, 0);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_project_created ON public.projects;
CREATE TRIGGER on_project_created
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_project();

-- Auto-generar key del issue (CLF-1, CLF-2...)
CREATE OR REPLACE FUNCTION public.handle_new_issue_key()
RETURNS TRIGGER AS $$
DECLARE
  project_key TEXT;
  next_number INTEGER;
BEGIN
  SELECT key INTO project_key
  FROM public.projects
  WHERE id = NEW.project_id;

  UPDATE public.issue_sequences
  SET last_number = last_number + 1
  WHERE project_id = NEW.project_id
  RETURNING last_number INTO next_number;

  IF next_number IS NULL THEN
    RAISE EXCEPTION 'No sequence found for project %', NEW.project_id;
  END IF;

  NEW.key := project_key || '-' || next_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_issue_created ON public.issues;
CREATE TRIGGER on_issue_created
  BEFORE INSERT ON public.issues
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_issue_key();


-- ============================================================
-- 3. FUNCIONES HELPER
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_project_ids()
RETURNS SETOF UUID
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT project_id FROM public.project_members WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_user_role_in_project(p_project_id UUID)
RETURNS TEXT
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT role FROM public.project_members
  WHERE project_id = p_project_id AND user_id = auth.uid()
  LIMIT 1;
$$;


-- ============================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_sequences       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sprints               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epics                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_statuses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_issue_types   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_labels        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issues                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_labels          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_links           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_invitations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_action_tokens   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_invitations  ENABLE ROW LEVEL SECURITY;

-- La app usa service_role (admin client) para todas las operaciones
-- El admin client bypasea RLS automáticamente
-- Solo necesitamos permitir acceso autenticado básico para el anon client

CREATE POLICY "authenticated read" ON public.profiles        FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated read" ON public.projects        FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated read" ON public.project_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated read" ON public.issue_sequences FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated read" ON public.sprints         FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated read" ON public.epics           FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated read" ON public.project_statuses      FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated read" ON public.project_issue_types   FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated read" ON public.project_labels        FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated read" ON public.issues          FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated read" ON public.issue_labels    FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated read" ON public.issue_links     FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated read" ON public.comments        FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated read" ON public.attachments     FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated read" ON public.pending_invitations   FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated read" ON public.admin_action_tokens   FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated read" ON public.platform_invitations  FOR SELECT TO authenticated USING (true);


-- ============================================================
-- 5. ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_issues_project_id   ON public.issues(project_id);
CREATE INDEX IF NOT EXISTS idx_issues_assignee_id  ON public.issues(assignee_id);
CREATE INDEX IF NOT EXISTS idx_issues_sprint_id    ON public.issues(sprint_id);
CREATE INDEX IF NOT EXISTS idx_issues_epic_id      ON public.issues(epic_id);
CREATE INDEX IF NOT EXISTS idx_issues_kanban       ON public.issues(project_id, status, position);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id    ON public.project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_comments_issue_id   ON public.comments(issue_id);
CREATE INDEX IF NOT EXISTS idx_attachments_issue_id   ON public.attachments(issue_id);
CREATE INDEX IF NOT EXISTS idx_attachments_comment_id ON public.attachments(comment_id);


-- ============================================================
-- 6. STORAGE BUCKETS
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('comment-images', 'comment-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "public read avatars" ON storage.objects;
CREATE POLICY "public read avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "authenticated upload avatars" ON storage.objects;
CREATE POLICY "authenticated upload avatars"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "authenticated delete avatars" ON storage.objects;
CREATE POLICY "authenticated delete avatars"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "public read comment-images" ON storage.objects;
CREATE POLICY "public read comment-images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'comment-images');

DROP POLICY IF EXISTS "authenticated upload comment-images" ON storage.objects;
CREATE POLICY "authenticated upload comment-images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'comment-images');

DROP POLICY IF EXISTS "authenticated delete comment-images" ON storage.objects;
CREATE POLICY "authenticated delete comment-images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'comment-images');
