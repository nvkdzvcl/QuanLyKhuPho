[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$PromptPath,

    [ValidatePattern("^\d+[smh]$")]
    [string]$Timeout = "20m",

    [string]$Model = "gemini-3.7-flash-high",

    [ValidateSet("low", "medium", "high")]
    [string]$Effort = "high",

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

if ([string]::IsNullOrWhiteSpace($prompt)) {
    throw "Prompt file is empty: $resolvedPromptPath"
}

$workDir = Join-Path $repoRoot ".ai-work"
$handoffPath = Join-Path $workDir "last-handoff.md"

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
        HandoffPath = $handoffPath
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
    "--mode", "accept-edits",
    "--model", $Model,
    "--effort", $Effort,
    "--output-format", "json",
    "--print-timeout", $Timeout,
    "--print=$prompt"
)

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
    throw "Antigravity exited with code $agyExitCode."
}

try {
    $result = $rawJson | ConvertFrom-Json
}
catch {
    throw "Antigravity did not return valid JSON. Raw output: $rawJson"
}

if ($result.status -ne "SUCCESS") {
    throw "Antigravity returned status '$($result.status)': $($result.error)"
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

[System.IO.Directory]::CreateDirectory($workDir) | Out-Null
[System.IO.File]::WriteAllText(
    $handoffPath,
    $handoff,
    [System.Text.UTF8Encoding]::new($false)
)

$handoff
