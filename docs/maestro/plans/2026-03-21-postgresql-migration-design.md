---
design_depth: standard
task_complexity: medium
---

# Design: PostgreSQL Migration & Schema Expansion (Phase 4.1)

## 1. Problem Statement
The Portfolio Tracker currently relies on a local SQLite database, which is incompatible with serverless environments like Render Free Tier because data is lost upon every deployment or server spin-down. Additionally, the existing schema cannot support the complex quantitative signals (VXN, MSTR Z-score) and account silos (ISA, Overseas) defined in the "Jin-geun" Index Fund strategy.

## 2. Requirements
- **REQ-1 (Functional)**: Distinguish between ISA, OVERSEAS, and PENSION accounts for all assets and transactions.
- **REQ-2 (Functional)**: Perform a full data migration of all existing SQLite records to Supabase.
- **REQ-3 (Functional)**: Support historical quantitative data storage for VXN and MSTR corporate actions.
- **REQ-4 (Non-Functional)**: Ensure database persistence across server restarts.
- **REQ-5 (Non-Functional)**: Enforce data integrity using PostgreSQL native Enums for account types.
- **REQ-6 (Constraint)**: Use Supabase Transaction Pooler (Port 6543) for IPv4 compatibility.
- **REQ-7 (Constraint)**: Manage all schema changes via Alembic versioned migrations.

## 3. Approach
We will proceed with the **Cloud-First Institutional** approach. This involves:
- **Database**: Supabase (PostgreSQL) via Transaction Pooler.
- **Schema Management**: Alembic initialization in `backend/` for professional versioning.
- **Data Integrity**: Implementing native PostgreSQL Enums for `account_type`.
- **Migration Logic**: A robust ETL script (`migrate_sqlite_to_pg.py`) with transaction support to ensure zero data loss during the transfer.

### Decision Matrix
| Criterion | Weight | Cloud-First (Selected) | Pragmatic Port |
|-----------|--------|----------------------------|-------------------------|
| Data Integrity | 40% | 5: Enums and versioned migrations ensure total consistency. | 3: Reliant on manual script accuracy. |
| Maintainability| 30% | 5: Alembic provides a clear history of all changes. | 2: Difficult to manage schema evolution. |
| Speed of Setup | 30% | 3: Extra time for tool configuration. | 5: Immediate port with minimal changes. |
| **Weighted Total** | | **4.4** | **3.4** |

## 4. Risk Assessment
- **Connection Issues**: Mitigated by using the Transaction Pooler and explicit SQLAlchemy connection pooling.
- **Data Corruption during ETL**: Mitigated by using SQL transactions in the migration script, allowing for clean rollbacks on failure.
- **PostgreSQL Strictness**: Mitigated by using Alembic to explicitly define and cast data types during the initial schema creation.

## 5. Success Criteria
- [ ] Backend connects successfully to Supabase.
- [ ] Existing SQLite data is accurately reflected in Supabase tables.
- [ ] `Asset` and `Transaction` tables include the new `account_type` column.
- [ ] New `vxn_daily_history` and `mstr_corporate_actions` tables exist.
- [ ] Alembic is initialized and the first migration is successfully recorded.
