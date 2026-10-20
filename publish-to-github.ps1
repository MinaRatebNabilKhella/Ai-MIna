$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$source = (Resolve-Path -LiteralPath $PSScriptRoot).Path
$repoUrl = 'https://github.com/MinaRatebNabilKhella/Ai-MIna.git'
$required = @('index.html', 'config.js', 'app.js', 'supabase/schema.sql', '.github/workflows/deploy-pages.yml')
foreach ($file in $required) {
    if (-not (Test-Path -LiteralPath (Join-Path $source $file))) {
        throw "Required release file is missing: $file"
    }
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw 'Git is not installed. Install Git for Windows, reopen this window, and run this script again.'
}
if (Get-Command node -ErrorAction SilentlyContinue) {
    Push-Location $source
    try {
        & node scripts/check-release.mjs
        if ($LASTEXITCODE -ne 0) { throw 'Release check failed; nothing was uploaded.' }
        & node scripts/test-csv-reader.mjs
        if ($LASTEXITCODE -ne 0) { throw 'CSV test failed; nothing was uploaded.' }
    } finally {
        Pop-Location
    }
} else {
    Write-Warning 'Node.js is not installed locally, so local checks are skipped. GitHub Actions will run the release checks after the upload.'
}

Write-Host ''
Write-Host 'This script will replace the tracked files on the main branch of:' -ForegroundColor Yellow
Write-Host $repoUrl -ForegroundColor Yellow
Write-Host 'It will not upload .env files, node_modules, or build output.' -ForegroundColor Yellow
$answer = Read-Host 'Type PUBLISH to continue'
if ($answer -cne 'PUBLISH') {
    Write-Host 'Cancelled. No remote changes were made.'
    exit 0
}

$work = Join-Path $env:TEMP ('mina-student-ai-publish-' + [guid]::NewGuid().ToString('N'))
try {
    & git clone --depth 1 --branch main $repoUrl $work
    if ($LASTEXITCODE -ne 0) { throw 'Could not clone the GitHub repository. Check your internet connection and GitHub sign-in.' }

    Push-Location $work
    try {
        & git rm -r -f --ignore-unmatch .
        if ($LASTEXITCODE -gt 1) { throw 'Could not prepare the repository workspace.' }

        $excludedNames = @('.git', 'node_modules', 'dist', '.supabase')
        foreach ($item in Get-ChildItem -LiteralPath $source -Force) {
            if ($item.Name -in $excludedNames -or $item.Name -eq '.env' -or $item.Name -like '.env.*') { continue }
            Copy-Item -LiteralPath $item.FullName -Destination $work -Recurse -Force
        }

        $gitName = (& git config --global user.name 2>$null | Out-String).Trim()
        $gitEmail = (& git config --global user.email 2>$null | Out-String).Trim()
        if (-not $gitName) { $gitName = Read-Host 'Enter the name to show on this Git commit' }
        if (-not $gitEmail) { $gitEmail = Read-Host 'Enter the email to show on this Git commit (use your GitHub noreply email to keep your email private)' }
        & git config user.name $gitName
        & git config user.email $gitEmail
        & git add -A
        if ($LASTEXITCODE -ne 0) { throw 'Git could not stage the release files.' }
        & git commit -m 'Prepare Mina Student AI cloud release'
        if ($LASTEXITCODE -ne 0) { throw 'Git commit failed. Check the Git identity and repository status.' }
        & git push origin main
        if ($LASTEXITCODE -ne 0) { throw 'Git push failed. Sign in to GitHub when prompted, then run this script again.' }
    } finally {
        Pop-Location
    }
    Write-Host ''
    Write-Host 'Release files pushed successfully. Follow the two deployment workflows in GitHub Actions.' -ForegroundColor Green
    Write-Host 'Do not share API keys or Supabase access tokens in chat.' -ForegroundColor Yellow
} finally {
    if (Test-Path -LiteralPath $work) { Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue }
}
