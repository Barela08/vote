-- VotePro Complete Supabase Schema Definition with Unique Public Voter Constraint

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ELECTIONS TABLE
CREATE TABLE IF NOT EXISTS public.elections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL DEFAULT 'VotePro Election',
    status TEXT NOT NULL DEFAULT 'NOT_STARTED' CHECK (status IN ('NOT_STARTED', 'ACTIVE', 'ENDED')),
    start_at TIMESTAMPTZ,
    end_at TIMESTAMPTZ,
    winner_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. CANDIDATES TABLE
CREATE TABLE IF NOT EXISTS public.candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID REFERENCES public.elections(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    party TEXT NOT NULL,
    photo_url TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Foreign key reference for winner_id
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_elections_winner'
    ) THEN
        ALTER TABLE public.elections 
        ADD CONSTRAINT fk_elections_winner 
        FOREIGN KEY (winner_id) REFERENCES public.candidates(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. VOTES TABLE
CREATE TABLE IF NOT EXISTS public.votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID REFERENCES public.elections(id) ON DELETE CASCADE,
    candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE,
    voter_identifier TEXT NOT NULL,
    vote_type TEXT NOT NULL DEFAULT 'PUBLIC' CHECK (vote_type IN ('PUBLIC', 'ADMIN')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- MANDATORY UNIQUE CONSTRAINT FOR PUBLIC VOTES (1 DEVICE/BROWSER = 1 VOTE PER ELECTION)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_public_voter_per_election 
ON public.votes (election_id, voter_identifier) 
WHERE (vote_type = 'PUBLIC');

-- 4. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id TEXT NOT NULL DEFAULT 'admin',
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_candidates_election ON public.candidates(election_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_votes_election ON public.votes(election_id);
CREATE INDEX IF NOT EXISTS idx_votes_candidate ON public.votes(candidate_id);

-- 5. STORAGE BUCKET CONFIGURATION FOR CANDIDATE PHOTOS
INSERT INTO storage.buckets (id, name, public)
VALUES ('candidate-photos', 'candidate-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public Read Candidates Photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow Public Upload Candidates Photos" ON storage.objects;

CREATE POLICY "Public Read Candidates Photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'candidate-photos');

CREATE POLICY "Allow Public Upload Candidates Photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'candidate-photos');

-- 6. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.elections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read elections" ON public.elections;
DROP POLICY IF EXISTS "Allow public read candidates" ON public.candidates;
DROP POLICY IF EXISTS "Allow public insert votes" ON public.votes;
DROP POLICY IF EXISTS "Allow public read votes" ON public.votes;

CREATE POLICY "Allow public read elections" ON public.elections FOR SELECT USING (true);
CREATE POLICY "Allow public read candidates" ON public.candidates FOR SELECT USING (is_active = true);
CREATE POLICY "Allow public insert votes" ON public.votes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public read votes" ON public.votes FOR SELECT USING (true);

-- 7. ENABLE REALTIME
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'elections'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.elections;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'candidates'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.candidates;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'votes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.votes;
  END IF;
END $$;
