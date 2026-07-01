# FC 플랫폼 (v0.4.0)

FC 제로(`../`)와 **분리**된 사업 플랫폼 프론트엔드입니다. (R37)

## 현재 포함 (v0.4)

- 로비 4탭 + PC 3단 셸 (§5-3)
- **이메일 로그인/회원가입** (`auth.js`)
- **profiles** 조회 · **플랫폼 ID** 1회 설정 (M02)
- **내 구단** 목록 · **구단 만들기** (`rpc/create_club`)
- **멤버 M08~M10** — 초대 · 모집/신청 · 역할 변경 (`rpc-members.sql`)
- **구단 홈** — FC 제로 UI 포크 + `team_id` DB (`club/`)
- **알림** — 초대/신청 결과 연동 (§5-2)
- 매칭 탭 — UI 스텁 (다음: v0.5)

## Supabase 설정 (필수 순서)

1. `../setup/platform_setup/schema-v1.sql`
2. `../setup/platform_setup/rpc-create-club.sql`
3. **`../setup/platform_setup/rpc-members.sql`** ← 멤버 기능
4. Email Auth ON · Exposed tables (가이드 §3)

정본: **`../setup/SUPABASE_GUIDE_Platform.md`**

## 배포

| | |
|--|--|
| GitHub | `fc-team-platform` |
| Pages 로비 | `https://qotjdals147.github.io/fc-team-platform/` |

Project: `rdscgnvseplwlftjixom` (FOOTBALL_SITE_PLATFORM) · `js/config.js`

## 로컬 테스트 (멤버)

```bash
cd platform
npx --yes serve . -l 8770
```

1. 계정 2개 — 각각 platform_id 설정
2. A: 구단 만들기 → **멤버 관리** → B ID 초대
3. B: **받은 초대** 또는 알림 → 수락 → 구단 홈 명단 확인

## 문서

- `../docs/BUSINESS_VISION.md` §5-1, §15, §17, §19, §20
- `../setup/SUPABASE_GUIDE_Platform.md` §5.4
