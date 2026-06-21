param(
    # Selects the backing database for the pressure suite.
    [ValidateSet("h2", "mysql")]
    [string]$DbMode = "h2",
    # MySQL connection parameters, used only when `DbMode` is `mysql`.
    [string]$MysqlHost = "",
    [string]$MysqlPort = "3306",
    [string]$MysqlDatabase = "",
    [string]$MysqlUsername = "",
    [string]$MysqlPassword = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

Write-Host "Running pressure test suite..." -ForegroundColor Cyan

# Build the Maven argument list incrementally so mode-specific properties
# can be appended without duplicating the invocation.
$mvnArgs = @(
    "-q",
    "-Dtest=PressureTestSuite",
    "-Dpressure.test.db.mode=$DbMode"
)

if ($DbMode -eq "mysql") {
    # Fail fast when MySQL mode is requested without a complete connection tuple.
    if ([string]::IsNullOrWhiteSpace($MysqlHost) -or
        [string]::IsNullOrWhiteSpace($MysqlPort) -or
        [string]::IsNullOrWhiteSpace($MysqlDatabase) -or
        [string]::IsNullOrWhiteSpace($MysqlUsername) -or
        [string]::IsNullOrWhiteSpace($MysqlPassword)) {
        throw "MySQL mode requires MysqlHost, MysqlPort, MysqlDatabase, MysqlUsername, and MysqlPassword."
    }

    $mvnArgs += "-Daccount.test.mysql.host=$MysqlHost"
    $mvnArgs += "-Daccount.test.mysql.port=$MysqlPort"
    $mvnArgs += "-Daccount.test.mysql.database=$MysqlDatabase"
    $mvnArgs += "-Daccount.test.mysql.username=$MysqlUsername"
    $mvnArgs += "-Daccount.test.mysql.password=$MysqlPassword"
}

# Run the suite and let the test class generate Markdown, JSON, and CSV artifacts.
& mvn @mvnArgs test

Write-Host ""
Write-Host "Artifacts:" -ForegroundColor Green
Write-Host "  Report : PressTest/pressure-test-report.md"
Write-Host "  JSON   : PressTest/results/pressure-test-results.json"
Write-Host "  CSV    : PressTest/results/pressure-test-summary.csv"
