# FC 플랫폼 (v0.3.0)

FC 제로(`../`)와 **분리**된 사업 플랫폼 프론트엔드입니다. (R37)

## 현재 포함 (v0.3)

- 로비 4탭 + PC 3단 셸 (§5-3)
- **이메일 로그인/회원가입** (`auth.js`)
- **profiles** 조회 · **플랫폼 ID** 1회 설정 (M02)
- **내 구단** 목록 · **구단 만들기** (`rpc/create_club`)
- **구단 홈** — FC 제ero UI 포크 + `team_id` DB (`club/`)
- **알림** Supabase `notifications` 연동 (§5-2)
- 매칭 탭 — 로그인 게이트 + UI 스텁 (DB 연동 다음)

## Supabase 설정 (필수 순서)

1. `setup/schema-v1.sql`
2. **`setup/rpc-create-club.sql`** ← 구단 만들기 없으면 실패
3. Email Auth ON · Exposed tables (가이드 §3)

정본: **`../setup/SUPABASE_GUIDE_Platform.md`**

## 배포

| | |
|--|--|
| GitHub | `fc-team-platform` |
| Pages 로비 | `https://qotjdals147.github.io/fc-team-platform/` |

Project: `rdscgnvseplwlftjixom` (FOOTBALL_SITE_PLATFORM) · `js/config.js`

## 아직 없음

- matching_posts CRUD
- FC 제로 클라이언트 `team_id` 포크 (`club/`)
- 본인인증 API · Pro 결제
- RLS 정책 강화 (파일럿은 allow-all)

## 로컬 실행

```bash
cd platform
npx --yes serve .
```

## 문서

- `../docs/BUSINESS_VISION.md` §5-1, §15, §17, §19, §20
