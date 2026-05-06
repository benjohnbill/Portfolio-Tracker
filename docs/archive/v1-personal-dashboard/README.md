# v1 — Personal Dashboard (Archived 2026-05-05)

이 폴더는 **Portfolio Tracker v1**의 spec / 운영 문서 baseline입니다.

> **이 archive는 가장 최근 archive입니다 (2026-05-05).** 다른 archive (`docs/archive/conductor-bootstrap/`)는 이전 시기 산출물.

---

## Archive context

- **시점**: 2026-05-05
- **이유**: 제품 의도가 *개인 portfolio dashboard*에서 *질문 기반 맞춤형 금융 서비스*로 pivot. 새 비전 컨텍스트와 v1 컨텍스트가 강하게 다르므로, paradigm carry-over 위험을 피하기 위해 v1 spec set을 명시적으로 archive.
- **결정 근거**: paradigm hygiene — legacy 헤더 노트 (반쪽 단절)보다 archive (완전 단절)가 큰 전환에 정직.

---

## 활성 산출물 (현재 — 루트)

새 product 비전 + IA redesign 산출물:

- [`docs/superpowers/specs/2026-05-05-ia-redesign-design.md`](../../superpowers/specs/2026-05-05-ia-redesign-design.md)
- [`docs/superpowers/handoff/2026-05-05-product-vision-pivot.md`](../../superpowers/handoff/2026-05-05-product-vision-pivot.md)

---

## v1 spec set (이 폴더 내용)

| 파일 | 원래 위치 | 주제 |
|---|---|---|
| `PRODUCT.md` | `/PRODUCT.md` | 개인 dashboard 의도, 6 sleeve, scoring model, 6 accumulation axes, freeze contract |
| `ARCHITECTURE.md` | `/ARCHITECTURE.md` | API envelope pattern, service-layer partitioning, data pipeline |
| `DESIGN.md` | `/DESIGN.md` | YAML token system, palette, typography, layout, macro indicator badge convention, page hierarchies |
| `AGENTS.md` | `/AGENTS.md` | agent guidance, READ ORDER, child guides, conventions, anti-patterns |
| `CLAUDE.md` | `/CLAUDE.md` | project instructions, current contracts, pre-commit gotchas, review principles |
| `PLAN.md` | `/PLAN.md` | bootstrap / conductor reduction / legacy freeze batches |
| `DOMAIN_MAP.md` | `/DOMAIN_MAP.md` | deprecated bootstrap helper stub (4줄) |
| `api-domain.md` | `/docs/DOMAIN_MAP.md` | UX-1 13-surface API field registry, envelope contract, naming conventions |

### 누락 (history에서 reference 가능)

- `TODOS.ARCHIVED.md` — working dir에 이미 부재였으므로 archive 이동 못 함; `git log -- TODOS.ARCHIVED.md`로 history reference 가능
- `LOCAL_ENV_SETUP.md` — 삭제됨 (오라버니 명시); git history reference
- `MCP_USAGE_POLICY.md` — 삭제됨; git history reference
- `docs/local-setup.md` — 삭제됨; git history reference
- `CLAUDE.md.bak.20260504-194233` — 삭제됨 (untracked backup)

---

## 사용 안내

### ⚠ 무비판 carry-over 금지

새 vision 작업 중 v1 가정이 silently 흘러들어가지 않도록 주의. 특히:

- *솔로 사용자* 가정 (새 vision은 다중 사용자 가능성)
- *KRW 한국 시장 한정* 가정 (새 vision은 일반화 가능성)
- *6 sleeve 고정 분류* 가정 (새 vision은 사용자별 portfolio 다양성)
- *freeze contract* (개인 ritual 모델) — 새 vision의 사용자 행동 모델은 다를 수 있음

### ✓ 의식적 reference OK

새 vision이 *재사용 가능한* 부분을 *발견*했을 때 이 폴더에서 reference. 예:

- `DESIGN.md` — token system (palette, typography, spacing) 일부 carry value
- `ARCHITECTURE.md` — envelope pattern은 backend contract로 살아있음
- `CLAUDE.md` — current contract notes는 일부 새 vision에도 적용
- `api-domain.md` — backend API field registry는 그대로 작동

단, 어떤 v1 결정이라도 *왜 이 결정이 valid한지* 새 컨텍스트에서 *재검증*.

---

## 코드는 archive 안 됨

기능 코드 (`backend/`, `frontend/`, `backend/tests/`, `backend/alembic/`)는 archive 안 됨 — 작동 시스템. 새 vision이 *어떤 코드를 carry over할지* 결정 후 점진적 변경.

---

## 이전 archive와의 관계

```
docs/archive/
├── conductor-bootstrap/      (이전 시기 archive)
└── v1-personal-dashboard/    (이 폴더 — 가장 최근, 2026-05-05)
```

**가장 최근 archive는 항상 이 폴더입니다.** 이후 추가 archive 발생 시 새 폴더 추가.
