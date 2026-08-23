[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$PromptPath,

    [ValidatePattern("^\d+[smh]$")]
    [string]$Timeout = "8m",

    [string]$Model = "gemini-3.7-flash-high",

    [ValidateSet("low", "medium", "high")]
    [string]$Effort = "high",

    [switch]$Continue,

    [switch]$AllowChecks,

    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-CompactDiagnostic {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SourcePath,

        [Parameter(Mandatory = $true)]
        [string]$DestinationPath,

        [int]$TailLines = 80
    )

    $signals = @()
    if (Test-Path -LiteralPath $SourcePath -PathType Leaf) {
        $tail = @(Get-Content -LiteralPath $SourcePath -Tail $TailLines)
        $criticalPattern = "(?i)(permission check failed|user denied|soft-denying|soft denying|run ended with error|no response|not logged into Antigravity|quota (exceeded|exhausted|unavailable)|resource_exhausted|timed out|timeout|deadline exceeded|invalid json)"
        $contextPattern = "(?i)(authenticated successfully|resolving model)"
        $context = @($tail | Where-Object { $_ -match $contextPattern } | Select-Object -Last 2)
        $critical = @($tail | Where-Object { $_ -match $criticalPattern } | Select-Object -Last 5)
        $signals = @($context + $critical | Select-Object -Unique)

        if ($signals.Count -eq 0) {
            $signals = @($tail | Select-Object -Last 3)
        }
    }

    if ($signals.Count -eq 0) {
        $signals = @("No diagnostic signal was found in the final $TailLines log lines.")
    }

    $sanitized = foreach ($signal in $signals) {
        $line = [string]$signal
        $line = $line -replace '(?i)(postgres(?:ql)?://)[^@\s"]+@', '$1***@'
        $line = $line -replace '(?i)(password=)[^\s;"]+', '$1***'
        if ($line.Length -gt 500) {
            $line.Substring(0, 500) + "..."
        }
        else {
            $line
        }
    }

    [System.IO.File]::WriteAllLines(
        $DestinationPath,
        $sanitized,
        [System.Text.UTF8Encoding]::new($false)
    )
}

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\..\..\.."))
$repoPrefix = $repoRoot.TrimEnd("\") + "\"
$resolvedPromptPath = [System.IO.Path]::GetFullPath(
    (Resolve-Path -LiteralPath $PromptPath).Path
)

if (-not $resolvedPromptPath.StartsWith(
    $repoPrefix,
    [System.StringComparison]::OrdinalIgnoreCase
)) {
    throw "PromptPath must be inside the QuanLyKhuPho repository: $repoRoot"
}

$agyCommand = Get-Command agy -ErrorAction Stop
$prompt = Get-Content -Raw -LiteralPath $resolvedPromptPath
$repoRootForTools = $repoRoot.Replace("\", "/").TrimEnd("/")

if ([string]::IsNullOrWhiteSpace($prompt)) {
    throw "Prompt file is empty: $resolvedPromptPath"
}

$prompt += @"

REPOSITORY_TOOL_BOUNDARY
The only allowed filesystem workspace is $repoRootForTools. For every file
read, write, directory listing, glob, or search tool call, pass an explicit
absolute path beginning with $repoRootForTools/. Never pass an empty path, a
relative path such as ".", a home alias such as "~", a drive root, or any path
under C:/Users. Start repository discovery by listing $repoRootForTools itself.
If a broad search times out, retry with a narrower absolute path inside this
repository; never fall back to a parent or user-profile directory. Do not read
external requirements or configuration. If a repository-scoped file tool is
denied, stop and report the denial instead of requesting broader access.
"@

if (-not $AllowChecks) {
    $prompt += @"

AUTOMATION_EXECUTION_MODE
Implementation only. Use repository read/write tools only. Do not run shell
commands, tests, lint, builds, Git, Docker, or package-manager commands. Codex
will inspect the diff and run every verification command after handoff.
Never use RunCommand, a terminal, node -e, PowerShell, cmd, or shell commands to
read, create, or edit repository files. Edit PRECREATED_TARGETS and other files
with repository file tools only. If an unlisted new file is necessary, report
its path in KNOWN_RISKS instead of creating it through a command.
"@
}

$prompt += @"

COMPACT_HANDOFF_BUDGET
Return only FILES_CHANGED, CHANGE_SUMMARY, and KNOWN_RISKS with no preamble.
Use paths only under FILES_CHANGED, at most five summary bullets, at most three
risk bullets (or None), and no more than 350 words total. Do not repeat source,
tests, command output, or a narrative diff.
"@

$workDir = Join-Path $repoRoot ".ai-work"
$handoffPath = Join-Path $workDir "last-handoff.md"
$logPath = Join-Path $workDir "agy-run.log"
$diagnosticPath = Join-Path $workDir "agy-error-summary.txt"

[System.IO.Directory]::CreateDirectory($workDir) | Out-Null

if ($DryRun) {
    [pscustomobject]@{
        Executable = $agyCommand.Source
        WorkingDirectory = $repoRoot
        PromptPath = $resolvedPromptPath
        PromptCharacters = $prompt.Length
        Model = $Model
        Effort = $Effort
        Timeout = $Timeout
        Mode = "accept-edits"
        Continue = [bool]$Continue
        AllowChecks = [bool]$AllowChecks
        HandoffPath = $handoffPath
        LogPath = $logPath
        DiagnosticPath = $diagnosticPath
    }
    return
}

$availableModels = & $agyCommand.Source models
$modelsExitCode = $LASTEXITCODE

if ($modelsExitCode -ne 0) {
    throw "Unable to list Antigravity models; agy exited with code $modelsExitCode."
}

$modelFound = $availableModels | Where-Object {
    $_ -match "^\s*$([regex]::Escape($Model))\s"
}

if (-not $modelFound) {
    throw "Required Antigravity model is unavailable: $Model"
}

$agyArguments = @(
    "--add-dir", $repoRoot,
    "--mode", "accept-edits",
    "--model", $Model,
    "--effort", $Effort,
    "--output-format", "json",
    "--print-timeout", $Timeout,
    "--log-file", $logPath,
    "--print=$prompt"
)

if ($Continue) {
    $agyArguments = @("--continue") + $agyArguments
}

Push-Location -LiteralPath $repoRoot
try {
    $rawResult = & $agyCommand.Source @agyArguments
    $agyExitCode = $LASTEXITCODE
}
finally {
    Pop-Location
}

$rawJson = ($rawResult | Out-String).Trim()

if ($agyExitCode -ne 0) {
    Write-CompactDiagnostic -SourcePath $logPath -DestinationPath $diagnosticPath
    throw "Antigravity exited with code $agyExitCode. Compact diagnostic: $diagnosticPath"
}

try {
    $result = $rawJson | ConvertFrom-Json
}
catch {
    Write-CompactDiagnostic -SourcePath $logPath -DestinationPath $diagnosticPath
    throw "Antigravity did not return valid JSON. Compact diagnostic: $diagnosticPath"
}

if ($result.status -ne "SUCCESS") {
    Write-CompactDiagnostic -SourcePath $logPath -DestinationPath $diagnosticPath
    $status = [string]$result.status
    $errorDetails = if ($result.PSObject.Properties.Name -contains "error") {
        [string]$result.error
    }
    else {
        ""
    }
    $responseDetails = if ($result.PSObject.Properties.Name -contains "response") {
        [string]$result.response
    }
    else {
        ""
    }
    $details = if (-not [string]::IsNullOrWhiteSpace($errorDetails)) {
        $errorDetails
    }
    elseif (-not [string]::IsNullOrWhiteSpace($responseDetails)) {
        $responseDetails
    }
    else {
        $rawJson
    }

    $timeoutStatus = $status -match "(?i)^(timed[_ -]?out|timeout)$"
    $timeoutError = $errorDetails -match "(?i)(timed[ -]?out|timeout|deadline exceeded)"
    $timeoutResponse = $responseDetails -match "(?im)^\s*(error:\s*)?((the\s+)?(request|operation|stream|print mode)\s+)?(timed[ -]?out|timeout|deadline exceeded)"
    if ($timeoutStatus -or $timeoutError -or $timeoutResponse) {
        throw "Antigravity timed out after $Timeout. Review the existing diff; if the stream was only interrupted and no permission denial occurred, one compact -Continue run is allowed. Compact diagnostic: $diagnosticPath"
    }

    $permissionStatus = $status -match "(?i)^permission[_ -]?denied$"
    $specificPermissionError = $errorDetails -match "(?i)(permission check failed|approval (required|denied)|soft[- ]deny|soft denying|user denied)"
    $specificPermissionResponse = $responseDetails -match "(?im)^\s*(error:\s*)?(permission check failed|approval (required|denied)|soft[- ]deny|soft denying|user denied)"
    $plainPermissionError = $errorDetails -match "(?i)\bpermission denied\b"
    $plainPermissionResponse = $responseDetails -match "(?im)^\s*(error:\s*)?permission denied\b"

    if ($permissionStatus -or $specificPermissionError -or $specificPermissionResponse -or $plainPermissionError -or $plainPermissionResponse) {
        throw "Antigravity hit a permission denial. Do not retry with -Continue; review the existing diff and run verification in Codex. Compact diagnostic: $diagnosticPath"
    }

    $compactDetails = ($details -replace "[\r\n]+", " ").Trim()
    if ($compactDetails.Length -gt 500) {
        $compactDetails = $compactDetails.Substring(0, 500) + "..."
    }
    throw "Antigravity returned status '$status': $compactDetails. Compact diagnostic: $diagnosticPath"
}

$handoff = [string]$result.response
$requiredSections = @(
    "FILES_CHANGED",
    "CHANGE_SUMMARY",
    "KNOWN_RISKS"
)

foreach ($section in $requiredSections) {
    if ($handoff -notmatch "(?m)^\s*$section\s*$") {
        throw "Antigravity handoff is missing the '$section' section."
    }
}

[System.IO.File]::WriteAllText(
    $handoffPath,
    $handoff,
    [System.Text.UTF8Encoding]::new($false)
)

$handoff
