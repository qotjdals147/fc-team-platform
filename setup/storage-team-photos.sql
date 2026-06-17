-- FC 플랫폼 Storage — team-photos 버킷 RLS (별도 Supabase 프로젝트)
-- 버킷: team-photos (Public) — 대시보드에서 먼저 생성
-- 경로: {club_id}/{filename}  (FC 제로 A안 fc-zero/ 와 구분)

-- INSERT: 인증 사용자 (파일럿 — 추후 club admin만으로 좁힘)
CREATE POLICY "platform_photos_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'team-photos'
  AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
);

CREATE POLICY "platform_photos_select"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'team-photos');

CREATE POLICY "platform_photos_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'team-photos');
