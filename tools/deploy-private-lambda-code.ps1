param(
  [string]$Region = "us-west-2",
  [Parameter(Mandatory = $true)]
  [string]$LambdaFunctionName,
  [string]$SourcePath = ""
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
  throw "AWS CLI was not found. Install AWS CLI v2 and run 'aws configure' or 'aws sso login' first."
}

if (-not $SourcePath) {
  $repoRoot = Split-Path -Parent $PSScriptRoot
  $SourcePath = Join-Path $repoRoot "lambda\lambda_function.py"
}

if (-not (Test-Path -LiteralPath $SourcePath)) {
  throw "Lambda source file not found: $SourcePath"
}

$buildDir = Join-Path ([System.IO.Path]::GetTempPath()) ("luxnote-lambda-" + [guid]::NewGuid())
$zipPath = Join-Path ([System.IO.Path]::GetTempPath()) ("luxnote-lambda-" + [guid]::NewGuid() + ".zip")

try {
  New-Item -ItemType Directory -Force -Path $buildDir | Out-Null
  Copy-Item -LiteralPath $SourcePath -Destination (Join-Path $buildDir "lambda_function.py") -Force
  Compress-Archive -Path (Join-Path $buildDir "lambda_function.py") -DestinationPath $zipPath -Force

  aws lambda update-function-code `
    --region $Region `
    --function-name $LambdaFunctionName `
    --zip-file "fileb://$zipPath" |
    Out-Null

  Write-Host ""
  Write-Host "Lambda code deployed."
  Write-Host "Function: $LambdaFunctionName"
  Write-Host "Source:   $SourcePath"
}
finally {
  Remove-Item -LiteralPath $buildDir -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $zipPath -Force -ErrorAction SilentlyContinue
}
