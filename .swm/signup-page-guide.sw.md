---
title: 회원가입 기능 가이드
---

# 회원가입 기능 가이드

이 문서는 **회원가입 기능의 전체 구조와 구현 방법**을 설명합니다.

## ✅ 핵심 설계 원칙

1. **관심사 분리**: View와 비즈니스 로직 완전 분리
2. **타입 안전성**: OpenAPI 스펙 기반 자동 타입 생성
3. **재사용성**: 커스텀 훅으로 로직 캡슐화
4. **에러 처리**: React Query를 활용한 선언적 에러 처리

## ✅ 파일 구조

```
app/signup/page.tsx          → View (UI만 담당)
src/hooks/useAuth.ts          → 커스텀 훅 (로직 담당)
src/api/auth.ts               → API 호출
openapi.yaml                  → API 스펙 정의
```

## ✅ 1. View 레이어: SignupPage

페이지 컴포넌트는 **순수하게 UI만 담당**합니다.

```1:12:app/signup/page.tsx
"use client";

import { useSignup } from "@/src/hooks/useAuth";
import { useState } from "react";

/**
 * 회원가입 페이지
 *
 * 이 컴포넌트는 순수하게 View만 담당합니다.
 * 모든 비즈니스 로직은 useSignup 커스텀 훅에서 처리됩니다.
 */
export default function SignupPage() {
```

### State 관리

폼 입력값은 로컬 state로 관리합니다.

```13:17:app/signup/page.tsx
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const { mutate: signup, isPending, isSuccess, error } = useSignup();
```

**핵심 포인트:**

- `email`, `password`, `name`: 폼 입력값
- `useSignup()`: 커스텀 훅에서 회원가입 로직 가져오기
- `mutate`: 회원가입 실행 함수
- `isPending`: 로딩 상태
- `isSuccess`: 성공 여부
- `error`: 에러 정보

### 폼 제출 핸들러

실제 API 호출은 `signup` 함수가 처리합니다.

```19:22:app/signup/page.tsx
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    signup({ email, password, name });
  };
```

**왜 이렇게 간단한가?** → 모든 복잡한 로직(API 호출, 토큰 저장, 에러 처리)은 `useSignup` 훅에 캡슐화되어 있습니다!

### 성공/에러 메시지 UI

React Query의 상태를 그대로 UI에 반영합니다.

```34:60:app/signup/page.tsx
      {isSuccess && (
        <div
          style={{
            padding: "15px",
            marginBottom: "20px",
            backgroundColor: "#d4edda",
            color: "#155724",
            borderRadius: "5px",
          }}
        >
          ✅ 회원가입이 완료되었습니다!
        </div>
      )}

      {error && (
        <div
          style={{
            padding: "15px",
            marginBottom: "20px",
            backgroundColor: "#f8d7da",
            color: "#721c24",
            borderRadius: "5px",
          }}
        >
          ❌ {error.message}
        </div>
      )}
```

## ✅ 2. 로직 레이어: useSignup 훅

### useSignup 훅의 구조

React Query의 `useMutation`을 사용하여 회원가입 로직을 캡슐화합니다.

```24:41:src/hooks/useAuth.ts
export function useSignup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SignupRequest) => signup(data),
    onSuccess: (data) => {
      // 회원가입 성공 시 토큰 저장
      if (data.accessToken) {
        localStorage.setItem("accessToken", data.accessToken);
      }
      if (data.refreshToken) {
        localStorage.setItem("refreshToken", data.refreshToken);
      }
      // 사용자 정보 캐시 업데이트
      queryClient.setQueryData(["auth", "me"], data.user);
    },
  });
}
```

### ✅ useSignup의 책임

#### 1\. API 호출 (`mutationFn`)

```27:28:src/hooks/useAuth.ts
  return useMutation({
    mutationFn: (data: SignupRequest) => signup(data),
```

`SignupRequest` 타입은 <SwmPath>[openapi.yaml](/openapi.yaml)</SwmPath>에서 자동 생성됩니다:

```typescript
type SignupRequest = {
  email: string;
  password: string;
  name: string;
};
```

#### 2\. 토큰 저장 (`onSuccess`)

회원가입 성공 시 자동으로 실행됩니다:

```29:36:src/hooks/useAuth.ts
    onSuccess: (data) => {
      // 회원가입 성공 시 토큰 저장
      if (data.accessToken) {
        localStorage.setItem("accessToken", data.accessToken);
      }
      if (data.refreshToken) {
        localStorage.setItem("refreshToken", data.refreshToken);
      }
```

**왜 중요한가?** → 회원가입 성공 후 즉시 로그인 상태가 됩니다!

#### 3\. 캐시 업데이트

React Query 캐시에 사용자 정보를 저장합니다:

```37:38:src/hooks/useAuth.ts
      // 사용자 정보 캐시 업데이트
      queryClient.setQueryData(["auth", "me"], data.user);
```

**효과:**

- 다른 컴포넌트에서 <SwmToken path="/src/hooks/useAuth.ts" pos="13:4:6" line-data="export function useCurrentUser() {">`useCurrentUser()`</SwmToken>를 호출하면 즉시 사용자 정보를 가져올 수 있음
- 추가 API 호출 불필요!

## ✅ 3. API 레이어

실제 API 호출 함수

```1:23:src/api/auth.ts
// src/api/auth.ts
import { api } from "./client";
import { components } from "@/src/types/api";

type SignupRequest = components["schemas"]["SignupRequest"];
type LoginRequest = components["schemas"]["LoginRequest"];
type AuthResponse = components["schemas"]["AuthResponse"];
type User = components["schemas"]["User"];

/**
 * 회원가입
 */
export async function signup(data: SignupRequest) {
  const { data: response, error } = await api.POST("/auth/signup", {
    body: data,
  });

  if (error) {
    throw new Error(error.message || "회원가입에 실패했습니다");
  }

  return response as AuthResponse;
}
```

**타입 안전:**

- `SignupRequest`는 `openapi.yaml`에서 자동 생성
- `api.POST()`의 파라미터와 응답 타입도 자동 추론
- 컴파일 타임에 오류 발견!

## ✅ 4. API 스펙 정의

### 회원가입 API 엔드포인트

**POST /auth/signup**

```24:39:openapi.yaml
/auth/signup:
  post:
    summary: 회원가입
    tags:
      - Auth
    requestBody:
      required: true
      content:
        application/json:
          schema: { $ref: "#/components/schemas/SignupRequest" }
          examples:
            default:
              value:
                email: "user@example.com"
                password: "password123"
                name: "홍길동"
```

### 응답 코드

- **201 Created**: 회원가입 성공
- **400 Bad Request**: 유효하지 않은 입력 (이메일 형식 오류, 비밀번호 길이 등)
- **409 Conflict**: 이미 존재하는 이메일

### SignupRequest 스키마

```219:237:openapi.yaml
SignupRequest:
  type: object
  required:
    - email
    - password
    - name
  properties:
    email:
      type: string
      format: email
      description: 이메일 (로그인 ID)
    password:
      type: string
      minLength: 8
      description: 비밀번호 (최소 8자)
    name:
      type: string
      minLength: 2
      description: 사용자 이름
```

**이 정의가 자동으로:**

1. TypeScript 타입 생성
2. API 클라이언트 타입 체크
3. Swagger 문서 생성
4. Mock 서버 응답

### ✅ 성공 응답 예시 (201 Created)

```json
{
  "user": {
    "id": "user-001",
    "email": "user@example.com",
    "name": "홍길동",
    "createdAt": "2025-01-15T10:00:00Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**응답 필드:**

- `user`: 생성된 사용자 정보
- `accessToken`: 1시간 유효한 액세스 토큰
- `refreshToken`: 7일 유효한 리프레시 토큰

## ✅ 전체 데이터 흐름

```
1. 사용자가 폼 입력
   ↓
2. SignupPage에서 handleSubmit 실행
   ↓
3. signup({ email, password, name }) 호출
   ↓
4. useSignup 훅의 mutationFn 실행
   ↓
5. src/api/auth.ts의 signup() 함수 호출
   ↓
6. api.POST("/auth/signup") → 백엔드 API 호출
   ↓
7. 성공 시 onSuccess 콜백 실행:
   - localStorage에 토큰 저장
   - React Query 캐시 업데이트
   ↓
8. SignupPage의 isSuccess가 true로 변경
   ↓
9. 성공 메시지 표시!
```

## ✅ 핵심 패턴: View와 로직 분리

### ✅ 안 좋은 방식 (모든 로직이 컴포넌트에)

```typescript
export default function SignupPage() {
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        body: JSON.stringify({ email, password, name }),
      });
      const data = await response.json();
      localStorage.setItem("token", data.token);
      // ... 복잡한 로직들
    } catch (error) {
      // 에러 처리
    }
  };
}
```

### ✅ 좋은 방식 (커스텀 훅으로 분리)

컴포넌트는 단순하게!

```19:22:app/signup/page.tsx
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  signup({ email, password, name });
};
```

## ✅ 신규 개발자를 위한 가이드

### 1\. 회원가입 페이지 테스트

```bash
# 1. Mock 서버 시작
npm run mock

# 2. 개발 서버 시작
npm run dev

# 3. 브라우저에서 열기
http://localhost:3000/signup
```

### 2\. API 스펙 변경 시

```bash
# openapi.yaml 수정 후 타입 재생성
npx openapi-typescript openapi.yaml -o src/types/api.d.ts
```

### 3\. 커스텀 훅 사용 예시

```typescript
function MyComponent() {
  const { mutate, isPending, error } = useSignup();

  const handleClick = () => {
    mutate({ email: "test@test.com", password: "12345678", name: "테스트" });
  };

  return (
    <button onClick={handleClick} disabled={isPending}>
      {isPending ? "가입 중..." : "회원가입"}
    </button>
  );
}
```

## ✅ 관련 파일

- `app/signup/page.tsx` - 회원가입 페이지 (View)
- `src/hooks/useAuth.ts` - 인증 관련 훅
- `src/api/auth.ts` - API 호출 함수
- `openapi.yaml` - API 스펙 정의

## ✅ 에러 처리

### 1\. API 에러 케이스

#### 400 Bad Request - 유효하지 않은 입력

```json
{
  "message": "이메일 형식이 올바르지 않습니다",
  "code": "INVALID_EMAIL"
}
```

**발생 원인:**

- 이메일 형식 오류 (`format: email` 위반)
- 비밀번호가 8자 미만 (`minLength: 8` 위반)
- 이름이 2자 미만 (`minLength: 2` 위반)

#### 409 Conflict - 이미 존재하는 이메일

```json
{
  "message": "이미 가입된 이메일입니다",
  "code": "EMAIL_ALREADY_EXISTS"
}
```

### 2\. 프론트엔드 에러 처리

```typescript
const { mutate: signup, error } = useSignup();

// error 객체 구조
error.message; // "이미 가입된 이메일입니다"
```

React Query가 자동으로 에러를 캐치하고 `error` 상태로 제공합니다.

### 3\. 사용자 친화적 에러 메시지

```typescript
const getErrorMessage = (error: Error) => {
  if (error.message.includes("EMAIL_ALREADY_EXISTS")) {
    return "이미 가입된 이메일입니다. 다른 이메일을 사용해주세요.";
  }
  if (error.message.includes("INVALID_EMAIL")) {
    return "올바른 이메일 형식을 입력해주세요.";
  }
  return "회원가입에 실패했습니다. 다시 시도해주세요.";
};
```

## ✅ 주의사항

1. **컴포넌트에 직접 API 호출 금지**

   - 항상 커스텀 훅을 통해 API 호출
   - 로직 재사용성 & 테스트 용이성 향상

2. **타입 파일 수동 수정 금지**

   - `src/types/api.d.ts`는 자동 생성 파일
   - 변경 필요 시 `openapi.yaml` 수정 후 재생성

3. **토큰 관리**

   - `useSignup` 훅이 자동으로 토큰 저장
   - 수동으로 localStorage 조작하지 말 것

4. **에러 처리**

   - React Query의 `error` 객체를 활용
   - 사용자에게 명확한 에러 메시지 제공
   - 네트워크 에러와 서버 에러 구분

## ✅ 다음 단계

이 패턴을 이해했다면:

- `app/login/page.tsx` 로그인 페이지도 동일한 패턴
- `useLogin`, `useLogout` 훅도 같은 구조
- 다른 기능도 이 패턴으로 구현 가능!

## ✅ 베스트 프랙티스

### 1\. 폼 검증

**클라이언트 사이드 검증 추가:**

```typescript
const validateEmail = (email: string) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();

  // 유효성 검사
  if (!validateEmail(email)) {
    alert("올바른 이메일 형식을 입력해주세요.");
    return;
  }

  if (password.length < 8) {
    alert("비밀번호는 최소 8자 이상이어야 합니다.");
    return;
  }

  signup({ email, password, name });
};
```

### 2\. 로딩 상태 UX 개선

```typescript
<button disabled={isPending} style={{ opacity: isPending ? 0.5 : 1 }}>
  {isPending ? "가입 중..." : "회원가입"}
</button>
```

### 3\. 성공 후 리다이렉트

```typescript
const router = useRouter();

const { mutate: signup, isSuccess } = useSignup();

useEffect(() => {
  if (isSuccess) {
    setTimeout(() => {
      router.push("/dashboard");
    }, 1500); // 1.5초 후 대시보드로 이동
  }
}, [isSuccess, router]);
```

### 4\. 비밀번호 강도 표시

```typescript
const getPasswordStrength = (password: string) => {
  if (password.length < 8) return "약함";
  if (password.length < 12) return "보통";
  return "강함";
};
```

## ✅ 디버깅 팁

### React Query DevTools 활용

```typescript
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

function App() {
  return (
    <>
      {/* 앱 컴포넌트 */}
      <ReactQueryDevtools initialIsOpen={false} />
    </>
  );
}
```

**확인할 수 있는 정보:**

- API 요청/응답 상태
- 캐시된 데이터
- 에러 정보
- 리렌더링 트리거

### 네트워크 탭 확인

브라우저 개발자 도구의 Network 탭에서:

- **Request Payload**: 보낸 데이터 확인
- **Response**: 서버 응답 확인
- **Status Code**: HTTP 상태 코드 확인

## ✅ 보안 고려사항

1. **비밀번호는 절대 로깅하지 않기**

   ```typescript
   // ❌ 절대 금지
   console.log("Password:", password);

   // ✅ 로깅 필요시
   console.log("Form submitted with email:", email);
   ```

2. **HTTPS 사용 필수**

   - 프로덕션에서는 반드시 HTTPS 사용
   - HTTP로는 민감한 정보 전송 금지

3. **토큰 저장 주의**

   - `localStorage`는 XSS 공격에 취약
   - 더 안전한 방법: `httpOnly` 쿠키 사용 고려

## ✅ 참고 문서

- [React Query 공식 문서](https://tanstack.com/query/latest)
- [OpenAPI Specification](https://swagger.io/specification/)
- [Next.js 공식 문서](https://nextjs.org/docs)

<SwmMeta version="3.0.0" repo-id="Z2l0aHViJTNBJTNBY3Vyc29yLXBhcmN0aWNlJTNBJTNBNzA0aGo=" repo-name="cursor-parctice"><sup>Powered by [Swimm](https://app.swimm.io/)</sup></SwmMeta>
