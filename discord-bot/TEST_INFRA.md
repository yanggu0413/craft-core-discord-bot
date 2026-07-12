# E2E Test Infra: Minecraft-Discord Backend Bot

## Test Philosophy
- Opaque-box, requirement-driven. No dependency on implementation design.
- Methodology: Category-Partition + BVA + Pairwise + Workload Testing.

## Feature Inventory
| # | Feature | Source (requirement) | Tier 1 | Tier 2 | Tier 3 |
|---|---------|---------------------|:------:|:------:|:------:|
| 1 | Account Binding System | ORIGINAL_REQUEST R1/R5 | 5 | 5 | ✓ |
| 2 | Chat & Event Relay | ORIGINAL_REQUEST R1/R7 | 5 | 5 | ✓ |
| 3 | Support Ticket System | ORIGINAL_REQUEST R6/R5 | 5 | 5 | ✓ |
| 4 | Server Status display | ORIGINAL_REQUEST R5/R7 | 5 | 5 | ✓ |
| 5 | Command Forwarding & Admin | ORIGINAL_REQUEST R2 | 5 | 5 | ✓ |

## Test Architecture
- Test runner: Jest (`npm test`)
- Test cases: Located under `tests/` and `tests/e2e/`
- Mock Client: `tests/e2e/mock-minecraft-client.js`
- Interceptor: `tests/e2e/preload-mock.js` monkey-patches `discord.js`

## Coverage Thresholds
- Tier 1: ≥5 per feature
- Tier 2: ≥5 per feature
- Tier 3: pairwise coverage of major feature interactions
- Tier 4: ≥5 realistic application scenarios
