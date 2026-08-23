[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [switch]$Apply,

    [string]$TargetUserProfile = [Environment]::GetFolderPath("UserProfile")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\..\..\.."))
$repoRootForRules = $repoRoot.Replace("\", "/").TrimEnd("/")
$settingsPath = Join-Path $TargetUserProfile ".gemini\antigravity-cli\settings.json"

$requiredRules = @(
    "read_file($repoRootForRules)",
    "write_file($repoRootForRules)",
    "command(git (status|diff|ls-files|rev-parse|log).*)",
    "command(git status)",
    "command(git status -s)",
    "command(git status --short)",
    "command(git log -n 3 --oneline)",
    "command(git diff)",
    "command(git diff .*)",
    "command(git diff .agents/skills/khu-pho-antigravity-orchestrator/scripts/setup-agy-automation.ps1)",
    "command(git diff --check)",
    "command(git diff --stat)",
    "command(node -v; pnpm -v)",
    "command(node -v; pnpm -v; git status)",
    "command(node -v; pnpm -v; docker -v; docker compose version)",
    "command(pwd)",
    "command(Get-Location)",
    'command(Get-ChildItem -Directory -Filter "*quanlykhupho*" -Recurse -Depth 2 -ErrorAction SilentlyContinue)',
    "command(pnpm install)",
    "command(pnpm list .*)",
    "command(pnpm (lint|typecheck|test|build))",
    "command(pnpm lint)",
    "command(pnpm typecheck)",
    "command(pnpm test)",
    "command(pnpm lint; pnpm typecheck; pnpm test)",
    "command(pnpm --filter @quanlykhupho/shared-types test && pnpm --filter @quanlykhupho/api test)",
    "command(pnpm --filter @quanlykhupho/shared-types test)",
    "command(pnpm --filter @quanlykhupho/shared-types lint)",
    "command(pnpm --filter @quanlykhupho/shared-types typecheck)",
    "command(pnpm --filter @quanlykhupho/shared-types build)",
    "command(pnpm --filter @quanlykhupho/shared-types (build|lint|typecheck|test))",
    "command(pnpm --filter @quanlykhupho/api test)",
    "command(pnpm --filter @quanlykhupho/api lint)",
    "command(pnpm --filter @quanlykhupho/api typecheck)",
    "command(pnpm --filter @quanlykhupho/api build)",
    "command(pnpm --filter .* test)",
    "command(pnpm build)",
    "command(pnpm exec turbo run (lint|typecheck|test|build).*)",
    "command(pnpm exec turbo run lint typecheck test build --force)",
    "command(.*prisma validate)",
    "command(pnpm --filter @quanlykhupho/api exec prisma validate)",
    "command(pnpm --filter @quanlykhupho/api exec prisma generate)",
    "command(pnpm --filter @quanlykhupho/api (prisma:generate|lint|typecheck|test|build))",
    "command(pnpm --filter api lint)",
    "command(pnpm --filter api typecheck)",
    "command(pnpm --filter api test)",
    "command(pnpm --filter api build)",
    "command(pnpm --filter @quanlykhupho/web (lint|typecheck|test|build))",
    "command(pnpm --filter @quanlykhupho/web lint)",
    "command(pnpm --filter @quanlykhupho/web typecheck)",
    "command(pnpm --filter @quanlykhupho/web test)",
    "command(pnpm --filter @quanlykhupho/web build)",
    "command(pnpm --filter web lint)",
    "command(pnpm --filter web typecheck)",
    "command(pnpm --filter web test)",
    "command(pnpm --filter web build)",
    'command(\$env:DATABASE_URL=.*; pnpm --filter @quanlykhupho/api exec prisma validate)',
    'command($env:DATABASE_URL="postgresql://user:pass@localhost:5432/db"; pnpm --filter @quanlykhupho/api exec prisma validate)',
    'command(\$env:DATABASE_URL=.*; pnpm --filter @quanlykhupho/api prisma validate)',
    "command(docker compose -f docker/docker-compose\.yml config)",
    "command(docker compose -f docker/docker-compose.yml config)",
    "command(docker compose -f docker/docker-compose.yml config --quiet)"
)

if (-not $Apply) {
    [pscustomobject]@{
        SettingsPath = $settingsPath
        Repository = $repoRoot
        ApplyRequired = $true
        Rules = $requiredRules
    }
    return
}

if (-not (Test-Path -LiteralPath $settingsPath -PathType Leaf)) {
    throw "Antigravity CLI settings were not found: $settingsPath"
}

$settings = Get-Content -Raw -LiteralPath $settingsPath | ConvertFrom-Json

if ($null -eq $settings.permissions) {
    $settings | Add-Member -NotePropertyName permissions -NotePropertyValue ([pscustomobject]@{})
}

$existingRules = @()
if ($null -ne $settings.permissions.allow) {
    $existingRules = @($settings.permissions.allow)
}

$mergedRules = @($existingRules + $requiredRules | Sort-Object -Unique)
$settings.permissions | Add-Member -NotePropertyName allow -NotePropertyValue $mergedRules -Force

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = "$settingsPath.quanlypho-$timestamp.bak"

if ($PSCmdlet.ShouldProcess($settingsPath, "Back up and add scoped QuanLyKhuPho automation permissions")) {
    Copy-Item -LiteralPath $settingsPath -Destination $backupPath
    $json = $settings | ConvertTo-Json -Depth 20
    [System.IO.File]::WriteAllText(
        $settingsPath,
        $json + [Environment]::NewLine,
        [System.Text.UTF8Encoding]::new($false)
    )
}

[pscustomobject]@{
    SettingsPath = $settingsPath
    BackupPath = $backupPath
    Repository = $repoRoot
    AddedRules = @($requiredRules | Where-Object { $_ -notin $existingRules })
}
