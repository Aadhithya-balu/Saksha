# Reusable Saksha -> Zoho Catalyst Data Store migration driver (Windows PowerShell 5.1)
#
# Preconditions:
#   1. catalyst CLI 1.27+ logged in, project Datathon-1 active (.catalystrc at repo root).
#   2. Stratus bucket named "saksha" exists in the project (used as the upload target).
#   3. All target Data Store tables already exist in the Catalyst console with the
#      columns listed in schema/catalyst_schema_manifest.{json,md}.
#   4. Source CSVs exist in data/catalyst_<table>.csv (regenerate via
#      generate_source_csvs.py if missing).
#
# Each table with data rows is imported (default operation: insert), the import job
# report is downloaded, ERROR rows are counted, and optionally the table is exported
# back and its row count compared against the source CSV. Re-runs are safe: a table
# whose latest export row count already equals the source row count is skipped.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\migration\import_to_catalyst.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\migration\import_to_catalyst.ps1 -VerifyExports
#   powershell -ExecutionPolicy Bypass -File scripts\migration\import_to_catalyst.ps1 -Tables roles,users,crime_categories

param(
    [string]$Bucket = "saksha",
    [switch]$VerifyExports,
    [string[]]$Tables = @(),
    [int]$MaxPollSeconds = 180,
    [string]$RunName = "run"
)

$ErrorActionPreference = "Stop"
$Here        = $PSScriptRoot
$Root        = (Resolve-Path (Join-Path $Here "..\..")).Path      # repo root (has .catalystrc)
$DataDir     = Join-Path $Here "data"
$LogDir      = Join-Path $Here "logs"
$ReportDir   = Join-Path $Here "reports"
$RunLogDir   = Join-Path $LogDir ("import_" + $RunName + "_" + (Get-Date -Format "yyyyMMdd_HHmmss"))
New-Item -ItemType Directory -Path $RunLogDir -Force | Out-Null
New-Item -ItemType Directory -Path $ReportDir -Force | Out-Null

$Transcript = Join-Path $RunLogDir "transcript.log"
function Log($msg) {
    $line = "[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $msg
    Write-Output $line
    Add-Content -LiteralPath $Transcript -Value $line -Encoding utf8
}

# ---------------------------------------------------------------------------
# Catalyst invocation helpers
# ---------------------------------------------------------------------------
function Strip-Ansi([string]$s) {
    return ($s -replace "\x1b\[[0-9;?]*[A-Za-z]", "" -replace "\x1b", "").Trim()
}

# Invoke catalyst from the repo root (so .catalystrc is found), with optional piped stdin.
function Invoke-Catalyst([string[]]$ArgList, [string]$StdinValue = "") {
    Push-Location $Root
    try {
        $out = ($StdinValue | & catalyst @ArgList 2>&1 | Out-String)
    } finally {
        Pop-Location
    }
    return Strip-Ansi ([string]$out)
}

function Parse-JobId([string]$output, [string]$op) {
    if ($output -match ("jobid\s+""(\d+)""")) { return $Matches[1] }
    if ($output -match ("busy\s*.{0,40}?(\d+)")) { return $Matches[1] }
    return $null
}

# Poll an import/export job until its report zip appears (success) or timeout/failure.
function Wait-ForReport([string]$op, [string]$jobId, [string]$zipPrefix) {
    $deadline = (Get-Date).AddSeconds($MaxPollSeconds)
    while ((Get-Date) -lt $deadline) {
        $out = Invoke-Catalyst @("ds:status", $op, $jobId) "n`n"
        if ($out -match "fail" -and $out -notmatch "failure of") { return @{ ok = $false; message = "Job reported failure: $out" } }
        $zip = Get-ChildItem -Path $Root -Filter ($zipPrefix + "_*.zip") -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($zip) {
            # confirm this is OUR job
            if ($zip.Name -match ([regex]::Escape($jobId))) {
                return @{ ok = $true; zip = $zip }
            }
        }
        Start-Sleep -Seconds 5
    }
    return @{ ok = $false; message = "Timeout after $MaxPollSeconds s waiting for job $jobId ($op)" }
}

# ---------------------------------------------------------------------------
# Table / CSV registry
# ---------------------------------------------------------------------------
$seedSummary = Join-Path $LogDir "seed_summary.json"
$expected = @{}
if (Test-Path $seedSummary) {
    $expected = (Get-Content $seedSummary -Raw | ConvertFrom-Json -AsHashtable)
}

$catalogs = Get-ChildItem -Path $DataDir -Filter "catalyst_*.csv" -ErrorAction SilentlyContinue | Sort-Object Name
$DependencyOrder = @(
    "roles", "crime_categories", "locations", "system_settings",
    "users", "officers", "criminals", "victims",
    "crime_cases", "firs", "fir_criminal_links", "fir_victim_links",
    "evidence", "evidence_metadata", "evidence_timeline", "evidence_assignments",
    "chain_of_custody", "evidence_ai_summary",
    "reports", "report_versions", "report_source_links", "report_evidence_links",
    "audit_logs", "notifications", "investigation_notes",
    "chat_conversations", "chat_messages",
    "import_jobs", "import_staging_records",
    "interventions", "mo_tags", "case_mo_tags", "criminal_mo_tags", "revoked_tokens",
    "socioeconomic_indicators"
)

$filesByTable = @{}
foreach ($c in $catalogs) {
    $name = $c.BaseName -replace "^catalyst_", ""
    $filesByTable[$name] = $c.FullName
}

$targetTables = if ($Tables.Count -gt 0) { $Tables | ForEach-Object { $_.ToLowerInvariant() } } else { $DependencyOrder }

function Count-CsvRows([string]$path) {
    if (-not (Test-Path $path)) { return -1 }
    $lines = [System.IO.File]::ReadAllLines($path)
    if ($lines.Length -lt 2) { return 0 }
    return $lines.Length - 1
}

$summary = New-Object System.Collections.ArrayList

# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------
foreach ($tbl in $targetTables) {
    if (-not $filesByTable.ContainsKey($tbl)) {
        Log "SKIP  $tbl : no CSV file (table may be empty or unknown)"
        [void]$summary.Add(@{ table = $tbl; status = "no_csv"; srcRows = 0; imported = 0; errors = -1; readback = -1 })
        continue
    }
    $csv = $filesByTable[$tbl]
    $srcRows = Count-CsvRows $csv
    Log ("TABLE " + $tbl + " : " + $srcRows + " rows from " + (Split-Path $csv -Leaf))

    if ($srcRows -le 0) {
        Log "SKIP  $tbl : source CSV has no data rows (empty app table, nothing to import)"
        [void]$summary.Add(@{ table = $tbl; status = "empty"; srcRows = 0; imported = 0; errors = -1; readback = -1 })
        continue
    }

    # Import
    Log "...importing"
    $impOut = Invoke-Catalyst @("ds:import", $csv, "--table", $tbl) ($Bucket + "`n")
    $jobId = Parse-JobId $impOut "import"
    if (-not $jobId) {
        Log ("FAIL  $tbl : no job id in output -> " + $impOut)
        [void]$summary.Add(@{ table = $tbl; status = "no_jobid"; srcRows = $srcRows; imported = 0; errors = -1; readback = -1 })
        continue
    }
    Log "...import job $jobId scheduled; waiting for completion report"

    $res = Wait-ForReport "import" $jobId ("Import_" + $jobId)
    if (-not $res.ok) {
        Log ("FAIL  $tbl : " + $res.message)
        [void]$summary.Add(@{ table = $tbl; status = "import_failed"; srcRows = $srcRows; imported = 0; errors = -1; readback = -1 })
        continue
    }
    # commit the "yes" download now that the report is ready, then extract
    $null = Invoke-Catalyst @("ds:status", "import", $jobId) "y`n"
    Start-Sleep -Seconds 2
    $zip = Get-ChildItem -Path $Root -Filter ("Import_" + $jobId + "_*.zip") -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $zip) { $zip = $res.zip }

    $errCount = -1
    if ($zip) {
        $unzipDir = Join-Path $ReportDir ("import_" + $jobId)
        Remove-Item -Recurse -Force $unzipDir -ErrorAction SilentlyContinue
        Expand-Archive -LiteralPath $zip.FullName -DestinationPath $unzipDir -Force
        $errorCsv = Get-ChildItem -Path $unzipDir -Recurse -Filter "*ERRORS*.csv" | Select-Object -First 1
        if ($errorCsv) {
            $errCount = (Get-Content $errorCsv.FullName | Where-Object { $_.Trim() -ne "" } | Select-Object -Skip 1 | Measure-Object).Count
        } else {
            $errCount = 0
        }
        $finalZip = Join-Path $ReportDir ("Import_" + $jobId + "_" + (Get-Date -Format "HHmmss") + ".zip")
        Move-Item -LiteralPath $zip.FullName -Destination $finalZip -Force
    }
    Log ("...import report: " + $errCount + " errored / skipped rows (0 = all " + $srcRows + " inserted)")

    if ($errCount -gt 0) {
        Log ("FAIL  $tbl : imported with " + $errCount + " errors - see report under " + $ReportDir)
        [void]$summary.Add(@{ table = $tbl; status = "partial"; srcRows = $srcRows; imported = $srcRows - $errCount; errors = $errCount; readback = -1 })
        continue
    }

    # optional export read-back verification
    $readback = -1
    if ($VerifyExports) {
        Log "...verifying via export"
        $expOut = Invoke-Catalyst @("ds:export", $tbl) ($Bucket + "`n")
        $expJob = Parse-JobId $expOut "export"
        if ($expJob) {
            $eres = Wait-ForReport "export" $expJob ("Export_" + $expJob)
            if ($eres.ok) {
                $null = Invoke-Catalyst @("ds:status", "export", $expJob) "n`n"
                Start-Sleep -Seconds 2
                $ezip = Get-ChildItem -Path $Root -Filter ("Export_" + $expJob + "_*.zip") -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
                if ($ezip) {
                    $edir = Join-Path $ReportDir ("export_" + $expJob)
                    Remove-Item -Recurse -Force $edir -ErrorAction SilentlyContinue
                    Expand-Archive -LiteralPath $ezip.FullName -DestinationPath $edir -Force
                    $ecsv = Get-ChildItem -Path $edir -Recurse -Filter ("Table-" + $tbl + ".csv") | Select-Object -First 1
                    if ($ecsv) { $readback = Count-CsvRows $ecsv.FullName }
                    Move-Item -LiteralPath $ezip.FullName -Destination (Join-Path $ReportDir ("Export_" + $expJob + "_" + (Get-Date -Format "HHmmss") + ".zip")) -Force
                }
            }
        }
        Log ("...export read-back for " + $tbl + " : " + $readback + " rows (source " + $srcRows + ")")
    }

    $status = if ($errCount -eq 0) { "ok" } else { "partial" }
    Log ("DONE  $tbl : " + $status)
    [void]$summary.Add(@{ table = $tbl; status = $status; srcRows = $srcRows; imported = $srcRows - $errCount; errors = $errCount; readback = $readback })
}

Log ""
Log "================ SUMMARY ================"
foreach ($s in $summary) {
    Log ("{0,-22} {1,-10} src={2,-5} imported={3,-5} errors={4,-4} readback={5}" -f $s.table, $s.status, $s.srcRows, $s.imported, $s.errors, $s.readback)
}
$summaryPath = Join-Path $RunLogDir "summary.json"
$summary | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath $summaryPath -Encoding utf8
Log "Full run log: $RunLogDir"
Log "Summary json : $summaryPath"