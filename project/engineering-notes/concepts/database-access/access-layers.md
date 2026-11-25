# DB 접근 계층 구조

DB 접근 방식은 두 개의 축으로 나눠서 본다.

| 축 | 질문 | 선택지 |
|---|---|---|
| 아키텍처 | 클라이언트와 DB 사이에 누가 있나? | 3-Tier(직접 만든 백엔드) / BaaS(PostgREST) / 서버리스 |
| 연결 경로 | 그 서버가 DB에 어떻게 붙나? | Direct Connection(PostgreSQL에 바로) / 커넥션 풀러 경유 |

---

DB에 접근하는 아키텍처는 크게 세 가지 방식으로 나눌 수 있다.

1. 전통적인 3-Tier 백엔드 아키텍처
2. BaaS / API 자동 생성 아키텍처
3. 서버리스 / 엣지 아키텍처

---

## 1. 전통적인 3-Tier 백엔드 아키텍처 (가장 표준)

프론트엔드와 DB 사이에 개발자가 직접 비즈니스 로직을 코딩한 전용 백엔드 서버를 두는 방식.

```
[ 프론트엔드 (Web/App) ]
          │  (REST / gRPC / GraphQL)
          ▼
[ 백엔드 서버 (Spring Boot, FastAPI, NestJS 등) ] ◄── 비즈니스 로직, 결제, 외부 API 연동
          │  (ORM: JPA, SQLAlchemy, Prisma 등)
          ▼
[ 커넥션 풀러 (PgBouncer) ] ──▶ [ PostgreSQL ]
```

---

## 2. BaaS (Backend-as-a-Service) / API 자동 생성 아키텍처

백엔드 서버를 직접 짜는 대신, DB 스키마를 기반으로 API를 자동 생성해 주는 미들웨어(PostgREST, Hasura 등)를 앞세우는 방식. 프론트엔드에서 백엔드 서버 개발 없이 DB에 바로 접근하기 위한 구조.

```
[ 프론트엔드 / 클라이언트 (supabase-js, supabase-py) ]
          │  (HTTP 요청 + JWT 토큰)
          ▼
[ 자동 API 계층 (PostgREST, Hasura) ] ◄── DB 권한(RLS)으로 보안 제어
          │
          ▼
[ 커넥션 풀러 (Supavisor) ] ──▶ [ PostgreSQL ]
```

- **특징:** 프론트엔드 개발자가 백엔드 없이 DB 데이터를 직접 읽고 쓸 수 있다.
- **장점:** 백엔드 개발 공수가 거의 들지 않아 스타트업, MVP, 사이드 프로젝트에서 개발 속도가 압도적으로 빠르다.
- **단점:** 여러 테이블을 엮어 복잡한 트랜잭션이나 외부 API를 호출하는 고난도 비즈니스 로직을 넣기 까다롭다.

---

## 3. 서버리스 / 엣지 아키텍처

상시 떠 있는 백엔드 서버 대신, 요청이 들어올 때만 잠깐 실행되는 서버리스 함수(AWS Lambda, Vercel Edge Functions 등)에서 DB에 붙는 방식.

```
[ 프론트엔드 ] ──▶ [ 서버리스 함수 (수천 개가 동시에 켜졌다 꺼짐) ]
                                    │  (HTTP 기반 쿼리 또는 외부 풀러 필수)
                                    ▼
                        [ 커넥션 풀러 (Supavisor, Neon Pooler) ] ──▶ [ PostgreSQL ]
```

- DB 커넥션이 순식간에 폭발하므로 외부 커넥션 풀러(Supavisor 등)나 HTTP 기반 DB 드라이버가 반필수적이다.

---

## 연결 경로

아키텍처와 별개로, 서버가 DB에 붙는 방식은 두 가지다. 노트의 아키텍처 그림에 있는 커넥션 풀러는 선택 사항이다.

### Direct Connection

풀러를 건너뛰고 PostgreSQL에 바로 붙는 방식.

```
[ 백엔드 ] ─────────────────→ [ PostgreSQL ]
```

### 커넥션 풀러 경유

풀러가 여러 클라이언트 연결을 소수의 DB 연결로 묶어서 PostgreSQL에 전달하는 방식.

```
[ 백엔드 ] → [ PgBouncer ] → [ PostgreSQL ]
```
