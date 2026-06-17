# FC 플랫폼 (v1 스캐폴드)

FC 제로(`../`)와 **분리**된 사업 플랫폼 프론트엔드 초안입니다. (R37)

## 현재 포함

- 로비 4탭 + **PC 3단 셸**(좌·우 광고 레일) · 모바일 전폭 (§5-3)
- 알림 패널 + 미읽음 뱃지 (§5-2, 목 데이터)
- 광고 슬롯 자리 표시 (§7.3, 개발 모드)
- 구단 홈 스텁: `club/index.html` (새 탭 연동 UI09)

## DB (별도 Supabase)

| 파일 | 용도 |
|------|------|
| **`../setup/SUPABASE_GUIDE_Platform.md`** | 플랫폼 프로젝트 생성·7단계·RLS |
| `setup/schema-v1.sql` | v1 SQL (실행용) |
| `setup/storage-team-photos.sql` | Storage RLS (B안) |

1. Supabase **새 프로젝트** 생성 (FC 제로 DB와 분리)
2. SQL Editor → `schema-v1.sql` 실행
3. `js/config.js`에 URL · anon key

## 아직 없음

- config.js 실제 KEY 연동
- Auth · REST 연동 (`api.js` 스텁만)
- FC 제로 클라이언트 `team_id` 포크

## 로컬 실행

```bash
cd platform
npx --yes serve .
# 또는 VS Code Live Server — platform/index.html
```

## 문서

- `../BUSINESS_VISION.md` §5-1, §5-2, §7.2, §7.3
