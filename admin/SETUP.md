# 관리자 편집기 설치

기존 공개 블로그는 GitHub Pages에 남고 이 Worker는 로그인·편집·저장만 담당합니다.
코드가 있다는 사실만으로 실제 로그인이나 게시가 검증된 것은 아닙니다.

## Worker 환경 설정

Cloudflare의 기존 Worker → Settings → Runtime Variables and Secrets에서 설정합니다.
기존 GITHUB_CLIENT_SECRET을 코드에 붙여넣거나 덮어쓰지 마세요.

| 종류 | 이름 | 내용 |
|---|---|---|
| Text | GITHUB_CLIENT_ID | 등록한 GitHub App의 공개 Client ID |
| Secret | GITHUB_CLIENT_SECRET | GitHub App의 Client secret |
| Secret | SESSION_SECRET | 32바이트 무작위 키를 hex로 인코딩한 64자리 |
| Text | ALLOWED_USER_ID | 본인 GitHub 계정의 고정 숫자 ID |
| Text | REPOSITORY | 블로그 저장소의 OWNER/REPOSITORY |
| Text | PUBLIC_SITE_URL | 끝에 /를 포함한 공개 블로그 기본 주소 |
| Text | ADMIN_ORIGIN | 경로와 끝 / 없이 https://로 시작하는 Worker origin |

Mac에서는 `openssl rand -hex 32 | tr -d '\n' | pbcopy`로 SESSION_SECRET을 클립보드에 생성한 뒤 Cloudflare Secret 입력란에 붙여넣을 수 있습니다. 값을 채팅에 보내지 마세요. 잃어버려도 새 키로 교체할 수 있으며 기존 관리자 세션은 모두 만료됩니다.

## Worker 코드

Node 22 이상에서 `node admin/build.mjs`를 실행합니다. `admin/dist/worker.mjs`는 비밀값을 포함하지 않은 배포용 단일 모듈입니다.
Cloudflare 대시보드의 Edit code에서 이 번들로 기본 Hello World 코드를 교체하고 Deploy합니다.
Wrangler를 사용하는 경우 예시 `wrangler.jsonc`의 공개 변수를 실제 값으로 바꾸고 Secret은 대시보드/secret 명령으로만 등록합니다.
GitHub App의 Callback URL은 ADMIN_ORIGIN 뒤의 `/auth/callback`과 정확히 같아야 합니다.

## 공개 사이트 연결

`site/editor-config.js`에는 공개 Worker origin만 둡니다. 공개 16개 문서의 JSON, body markers, edit-link, 테스트 변경분을 함께 반영해야 합니다. JSON과 HTML 중 하나만 따로 올리지 마세요.
공개 사이트의 문서는 `content/public-posts.json`이 편집 원본입니다. 직접 HTML을 바꾸면 편집기는 충돌로 중단합니다. 자동 정리 도구도 이 원본을 함께 갱신하거나 별도 변경 제안을 만들어야 하며, 임의로 원본을 덮어쓰면 안 됩니다.
초안은 브라우저에만 저장합니다. 모든 GitHub 브랜치에 비공개 초안을 커밋하지 마세요.

## GitHub App 권한

- 본인 계정에만 설치하고 대상 저장소 한 개만 선택합니다.
- Repository Contents: Read and write, Metadata: Read-only.
- Pages 배포 결과를 관리자 화면에서 조회하려면 Actions: Read-only가 추가로 필요할 수 있습니다. 이 권한 없이도 저장을 시도할 수 있지만 배포 확인 불가로 표시할 수 있습니다. 권한을 자동으로 확대하지 않습니다.
- 실제 인증은 서버가 ALLOWED_USER_ID와 API 사용자 ID를 비교합니다. 설치 범위만으로 본인 인증을 대체하지 않습니다.

## 검증 순서와 한계

1. `/health`가 ready인지 확인합니다. 이것은 설정 형식 점검이며 Secret 유효성 검증이 아닙니다.
2. 공개 글의 수정 링크에서 본인 GitHub로 로그인합니다. 다른 계정/로그아웃 상태는 편집·게시되지 않아야 합니다.
3. 실제로 고치려는 내용을 수정하고 미리보기/임시 저장/내보내기를 확인합니다.
4. 게시 후 GitHub 저장됨과 Pages 배포 성공을 각각 확인합니다. 실패를 성공으로 간주하지 마세요.

테스트를 위해 기존 실제 글을 임의로 바꾸거나 토큰/비밀값을 로그에 출력하지 않습니다. 로그아웃은 현재 세션 쿠키만 제거하며, 복제된 세션의 즉시 무효화까지 보장하지는 않습니다.

## 현재 지원 범위

기존 글의 문단·소제목·인용·코드·목록·표를 수정합니다. 새 글 생성·글 삭제·이미지 업로드는 이번 버전에 포함하지 않습니다. 표/목록 안의 Enter는 같은 항목 줄바꿈이며 새 목록 항목은 별도 버튼으로 추가합니다. 지원 크기/서식을 넘긴 입력은 게시를 막고, 텍스트 백업으로 현재 입력을 복구할 수 있습니다.

로컬 자동 테스트와 번들 로드는 검증했지만 실제 브라우저의 한글 조합·선택/서식·모바일 화면, 실제 GitHub 로그인 및 Cloudflare 배포는 별도 확인이 필요합니다. 기존 demo의 소제목 앞 설명 간격은 재렌더링하면서 달라질 수 있으며 이전 demo 앵커(flow/loop/practice)는 새 목차의 section 번호로 변경됩니다. 원문 내용과 Python 실행기는 유지됩니다.
