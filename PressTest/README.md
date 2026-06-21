# PressTest

Pressure-test assets for the account-management backend.

## Layout

- `run-pressure-tests.ps1`
  - Entry script for the pressure suite.
- `scenario-config.json`
  - Scenario catalog and expected verification targets.
- `samples/`
  - Representative request payload samples for each scenario type.
- `results/`
  - Generated JSON and CSV outputs.
- `pressure-test-report.md`
  - Generated Markdown report.
- `压测文件说明.md`
  - File inventory for the pressure-test package.

## Execution

Default mode uses H2 in-memory storage:

```powershell
powershell -ExecutionPolicy Bypass -File .\PressTest\run-pressure-tests.ps1
```

MySQL mode uses the provided connection tuple:

```powershell
powershell -ExecutionPolicy Bypass -File .\PressTest\run-pressure-tests.ps1 `
  -DbMode mysql `
  -MysqlHost 127.0.0.1 `
  -MysqlPort 3306 `
  -MysqlDatabase account_db_pressure `
  -MysqlUsername TestAccount `
  -MysqlPassword '***'
```

## Scenarios

- `concurrent-account-opening`
  - Concurrent security-account + fund-account opening chain.
- `duplicate-fund-callback`
  - Idempotency validation for repeated fund-balance callbacks.
- `duplicate-holding-callback`
  - Idempotency validation for repeated holding callbacks.
- `concurrent-query-mix`
  - Mixed concurrent reads across dashboard, list, and log endpoints.

## Outputs

- `pressure-test-report.md`
  - Human-readable report.
- `results/pressure-test-results.json`
  - Structured scenario results.
- `results/pressure-test-summary.csv`
  - Tabular summary for quick comparison.
