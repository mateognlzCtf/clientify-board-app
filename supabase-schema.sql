-- ============================================================
-- CLIENTIFY BOARD — DATABASE SCHEMA
-- Ejecuta este archivo completo en: Supabase → SQL Editor
-- ============================================================


-- ============================================================
-- 1. TABLAS
-- ============================================================

-- profiles: espejo de auth.users con datos del perfil
-- Se crea automáticamente via trigger cuando un usuario se registra
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- projects: cada proyecto tiene una clave corta única (ej: CLF, PROJ)
CREATE TABLE IF NOT EXISTS public.projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  key         TEXT NOT NULL UNIQUE,
  description TEXT,
  owner_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- project_members: roles de cada usuario en cada proyecto
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

-- issue_sequences: contador por proyecto para generar keys únicas (CLF-1, CLF-2...)
-- La actualización es atómica para evitar colisiones con inserts concurrentes
CREATE TABLE IF NOT EXISTS public.issue_sequences (
  project_id   UUID PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  last_number  INTEGER NOT NULL DEFAULT 0
);

-- issues: los tickets del proyecto
CREATE TABLE IF NOT EXISTS public.issues (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  key         TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'backlog'
                CHECK (status IN ('backlog', 'todo', 'in_progress', 'in_review', 'done')),
  priority    TEXT NOT NULL DEFAULT 'medium'
                CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  type        TEXT NOT NULL DEFAULT 'task'
                CHECK (type IN ('bug', 'feature', 'task', 'improvement')),
  assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reporter_id UUID NOT NULL REFERENCES public.profiles(id),
  position    INTEGER NOT NULL DEFAULT 0,
  due_date    DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, key)
);

-- comments: comentarios en formato Tiptap JSON
CREATE TABLE IF NOT EXISTS public.comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id    UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES public.profiles(id),
  content     JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- attachments: archivos subidos a Supabase Storage
CREATE TABLE IF NOT EXISTS public.attachments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id    UUID REFERENCES public.issues(id) ON DELETE CASCADE,
  comment_id  UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
  file_name   TEXT NOT NULL,
  file_path   TEXT NOT NULL,
  file_size   INTEGER NOT NULL,
  mime_type   TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 2. FUNCIONES Y TRIGGERS
-- ============================================================

-- ── updated_at automático ─────────────────────────────────

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

CREATE OR REPLACE TRIGGER set_updated_at_issues
  BEFORE UPDATE ON public.issues
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER set_updated_at_comments
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── Crear perfil al registrarse ────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Agregar owner y crear secuencia al crear un proyecto ───

CREATE OR REPLACE FUNCTION public.handle_new_project()
RETURNS TRIGGER AS $$
BEGIN
  -- El creador es automáticamente owner del proyecto
  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner');

  -- Inicializar el contador de keys para este proyecto
  INSERT INTO public.issue_sequences (project_id, last_number)
  VALUES (NEW.id, 0);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_project_created ON public.projects;
CREATE TRIGGER on_project_created
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_project();

-- ── Auto-generar key del issue (CLF-1, CLF-2...) ──────────
-- Usa UPDATE atómico sobre issue_sequences para evitar colisiones

CREATE OR REPLACE FUNCTION public.handle_new_issue_key()
RETURNS TRIGGER AS $$
DECLARE
  project_key TEXT;
  next_number INTEGER;
BEGIN
  -- Obtener la clave del proyecto (ej: "CLF")
  SELECT key INTO project_key
  FROM public.projects
  WHERE id = NEW.project_id;

  -- Incrementar el contador de forma atómica
  UPDATE public.issue_sequences
  SET last_number = last_number + 1
  WHERE project_id = NEW.project_id
  RETURNING last_number INTO next_number;

  IF next_number IS NULL THEN
    RAISE EXCEPTION 'No se encontró secuencia para el proyecto %', NEW.project_id;
  END IF;

  -- Componer la key: "CLF-1", "CLF-2", etc.
  NEW.key := project_key || '-' || next_number;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_issue_created ON public.issues;
CREATE TRIGGER on_issue_created
  BEFORE INSERT ON public.issues
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_issue_key();


-- ============================================================
-- 3. FUNCIONES HELPER PARA RLS
-- SECURITY DEFINER: corren con privilegios del creador,
-- evitando la recursión en políticas que referencian
-- la misma tabla que protegen.
-- ============================================================

-- Devuelve los project_ids donde el usuario actual es miembro
CREATE OR REPLACE FUNCTION public.get_user_project_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT project_id
  FROM public.project_members
  WHERE user_id = auth.uid();
$$;

-- Devuelve el rol del usuario actual en un proyecto dado (NULL si no es miembro)
CREATE OR REPLACE FUNCTION public.get_user_role_in_project(p_project_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role
  FROM public.project_members
  WHERE project_id = p_project_id
    AND user_id = auth.uid()
  LIMIT 1;
$$;


-- ============================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issues          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments     ENABLE ROW LEVEL SECURITY;


-- ── PROFILES ──────────────────────────────────────────────

DROP POLICY IF EXISTS "authenticated users can view profiles" ON public.profiles;
CREATE POLICY "authenticated users can view profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "users can update own profile" ON public.profiles;
CREATE POLICY "users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());


-- ── PROJECTS ──────────────────────────────────────────────

DROP POLICY IF EXISTS "members can view their projects" ON public.projects;
CREATE POLICY "members can view their projects"
  ON public.projects FOR SELECT
  TO authenticated
  USING (id IN (SELECT public.get_user_project_ids()));

DROP POLICY IF EXISTS "authenticated users can create projects" ON public.projects;
CREATE POLICY "authenticated users can create projects"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "owners can update projects" ON public.projects;
CREATE POLICY "owners can update projects"
  ON public.projects FOR UPDATE
  TO authenticated
  USING (public.get_user_role_in_project(id) = 'owner')
  WITH CHECK (public.get_user_role_in_project(id) = 'owner');

DROP POLICY IF EXISTS "owners can delete projects" ON public.projects;
CREATE POLICY "owners can delete projects"
  ON public.projects FOR DELETE
  TO authenticated
  USING (public.get_user_role_in_project(id) = 'owner');


-- ── PROJECT MEMBERS ────────────────────────────────────────

DROP POLICY IF EXISTS "members can view project members" ON public.project_members;
CREATE POLICY "members can view project members"
  ON public.project_members FOR SELECT
  TO authenticated
  USING (project_id IN (SELECT public.get_user_project_ids()));

DROP POLICY IF EXISTS "owners and admins can add members" ON public.project_members;
CREATE POLICY "owners and admins can add members"
  ON public.project_members FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_user_role_in_project(project_id) IN ('owner', 'admin')
  );

DROP POLICY IF EXISTS "owners and admins can update member roles" ON public.project_members;
CREATE POLICY "owners and admins can update member roles"
  ON public.project_members FOR UPDATE
  TO authenticated
  USING (
    public.get_user_role_in_project(project_id) = 'owner'
    OR (
      public.get_user_role_in_project(project_id) = 'admin'
      AND role != 'owner'
    )
  )
  WITH CHECK (
    public.get_user_role_in_project(project_id) = 'owner'
    OR (
      public.get_user_role_in_project(project_id) = 'admin'
      AND role != 'owner'
    )
  );

DROP POLICY IF EXISTS "remove members" ON public.project_members;
CREATE POLICY "remove members"
  ON public.project_members FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.get_user_role_in_project(project_id) = 'owner'
    OR (
      public.get_user_role_in_project(project_id) = 'admin'
      AND role != 'owner'
    )
  );


-- ── ISSUE SEQUENCES ────────────────────────────────────────

DROP POLICY IF EXISTS "members can view sequences" ON public.issue_sequences;
CREATE POLICY "members can view sequences"
  ON public.issue_sequences FOR SELECT
  TO authenticated
  USING (project_id IN (SELECT public.get_user_project_ids()));


-- ── ISSUES ────────────────────────────────────────────────

DROP POLICY IF EXISTS "members can view issues" ON public.issues;
CREATE POLICY "members can view issues"
  ON public.issues FOR SELECT
  TO authenticated
  USING (project_id IN (SELECT public.get_user_project_ids()));

DROP POLICY IF EXISTS "members can create issues" ON public.issues;
CREATE POLICY "members can create issues"
  ON public.issues FOR INSERT
  TO authenticated
  WITH CHECK (
    project_id IN (SELECT public.get_user_project_ids())
    AND reporter_id = auth.uid()
  );

DROP POLICY IF EXISTS "members can update issues" ON public.issues;
CREATE POLICY "members can update issues"
  ON public.issues FOR UPDATE
  TO authenticated
  USING (project_id IN (SELECT public.get_user_project_ids()))
  WITH CHECK (project_id IN (SELECT public.get_user_project_ids()));

DROP POLICY IF EXISTS "owners and admins can delete issues" ON public.issues;
CREATE POLICY "owners and admins can delete issues"
  ON public.issues FOR DELETE
  TO authenticated
  USING (
    public.get_user_role_in_project(project_id) IN ('owner', 'admin')
  );


-- ── COMMENTS ──────────────────────────────────────────────

DROP POLICY IF EXISTS "members can view comments" ON public.comments;
CREATE POLICY "members can view comments"
  ON public.comments FOR SELECT
  TO authenticated
  USING (
    issue_id IN (
      SELECT id FROM public.issues
      WHERE project_id IN (SELECT public.get_user_project_ids())
    )
  );

DROP POLICY IF EXISTS "members can create comments" ON public.comments;
CREATE POLICY "members can create comments"
  ON public.comments FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND issue_id IN (
      SELECT id FROM public.issues
      WHERE project_id IN (SELECT public.get_user_project_ids())
    )
  );

DROP POLICY IF EXISTS "authors can update own comments" ON public.comments;
CREATE POLICY "authors can update own comments"
  ON public.comments FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "authors and admins can delete comments" ON public.comments;
CREATE POLICY "authors and admins can delete comments"
  ON public.comments FOR DELETE
  TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.issues i
      WHERE i.id = comments.issue_id
        AND public.get_user_role_in_project(i.project_id) IN ('owner', 'admin')
    )
  );


-- ── ATTACHMENTS ───────────────────────────────────────────

DROP POLICY IF EXISTS "members can view attachments" ON public.attachments;
CREATE POLICY "members can view attachments"
  ON public.attachments FOR SELECT
  TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR issue_id IN (
      SELECT id FROM public.issues
      WHERE project_id IN (SELECT public.get_user_project_ids())
    )
  );

DROP POLICY IF EXISTS "members can upload attachments" ON public.attachments;
CREATE POLICY "members can upload attachments"
  ON public.attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND (
      issue_id IN (
        SELECT id FROM public.issues
        WHERE project_id IN (SELECT public.get_user_project_ids())
      )
    )
  );

DROP POLICY IF EXISTS "uploaders can delete own attachments" ON public.attachments;
CREATE POLICY "uploaders can delete own attachments"
  ON public.attachments FOR DELETE
  TO authenticated
  USING (uploaded_by = auth.uid());


-- ============================================================
-- 5. ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_issues_project_id
  ON public.issues(project_id);

CREATE INDEX IF NOT EXISTS idx_issues_assignee_id
  ON public.issues(assignee_id);

CREATE INDEX IF NOT EXISTS idx_issues_status
  ON public.issues(status);

-- Índice compuesto para ordenar las columnas del Kanban por posición
CREATE INDEX IF NOT EXISTS idx_issues_kanban
  ON public.issues(project_id, status, position);

CREATE INDEX IF NOT EXISTS idx_project_members_user_id
  ON public.project_members(user_id);

CREATE INDEX IF NOT EXISTS idx_project_members_project_id
  ON public.project_members(project_id);

CREATE INDEX IF NOT EXISTS idx_comments_issue_id
  ON public.comments(issue_id);

CREATE INDEX IF NOT EXISTS idx_attachments_issue_id
  ON public.attachments(issue_id);

CREATE INDEX IF NOT EXISTS idx_attachments_comment_id
  ON public.attachments(comment_id);


-- ============================================================
-- 6. STORAGE — bucket para adjuntos e imágenes
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "authenticated users can upload" ON storage.objects;
CREATE POLICY "authenticated users can upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'attachments');

DROP POLICY IF EXISTS "public can read attachments" ON storage.objects;
CREATE POLICY "public can read attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'attachments');

DROP POLICY IF EXISTS "uploaders can delete own files" ON storage.objects;
CREATE POLICY "uploaders can delete own files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'attachments'
    AND owner = auth.uid()  -- fix: owner es UUID, no se necesita ::text
  );
