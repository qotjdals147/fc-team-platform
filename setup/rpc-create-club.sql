-- Supabase Query name: platform-rpc-create-club
-- FC 플랫폼 — 구단 생성 RPC (M05)
-- schema-v1.sql 실행 후 SQL Editor에서 1회 실행
-- teams 테이블은 Data API 미노출 → RPC로만 INSERT

CREATE OR REPLACE FUNCTION public.create_club(
  p_slug text,
  p_name text,
  p_region text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_team_id bigint;
  v_club_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  INSERT INTO public.teams DEFAULT VALUES RETURNING id INTO v_team_id;

  INSERT INTO public.clubs (team_id, slug, name, region, owner_id)
  VALUES (v_team_id, p_slug, p_name, p_region, v_uid)
  RETURNING id INTO v_club_id;

  INSERT INTO public.club_members (club_id, user_id, role, status)
  VALUES (v_club_id, v_uid, 'owner', 'active');

  INSERT INTO public.field (team_id, id) VALUES (v_team_id, 1);
  INSERT INTO public.meta (team_id, key, value) VALUES (v_team_id, 'myTeam', p_name);

  RETURN jsonb_build_object(
    'club_id', v_club_id,
    'team_id', v_team_id,
    'slug', p_slug,
    'name', p_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_club(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_club(text, text, text) TO anon;
