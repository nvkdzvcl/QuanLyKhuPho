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
"@
}

$workDir = Join-Path $repoRoot ".ai-work"
$handoffPath = Join-Path $workDir "last-handoff.md"
$logPath = Join-Path $workDir "agy-run.log"

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
    throw "Antigravity exited with code $agyExitCode. Diagnostic log: $logPath"
}

try {
    $result = $rawJson | ConvertFrom-Json
}
catch {
    throw "Antigravity did not return valid JSON. Raw output: $rawJson"
}

if ($result.status -ne "SUCCESS") {
    $details = if ($result.PSObject.Properties.Name -contains "error") {
        [string]$result.error
    }
    elseif ($result.PSObject.Properties.Name -contains "response") {
        [string]$result.response
    }
    else {
        $rawJson
    }

    if ($details -match "(?i)(permission|approval|soft-deny|soft denying|user denied)") {
        throw "Antigravity hit a permission denial. Do not retry with -Continue; review the existing diff and run verification in Codex. Diagnostic log: $logPath"
    }

    throw "Antigravity returned status '$($result.status)': $details. Diagnostic log: $logPath"
}

$handoff = [string]$result.response
$requiredSections = @(
    "FILES_CHANGED",
    "CHANGE_SUMMARY",
    "TESTS",
    "KNOWN_RISKS",
    "DIFF_SUMMARY"
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
