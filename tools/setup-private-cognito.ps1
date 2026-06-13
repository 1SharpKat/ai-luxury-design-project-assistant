param(
  [string]$Region = "us-west-2",
  [string]$UserPoolName = "LuxNotePrivateUsers",
  [Parameter(Mandatory = $true)]
  [string]$DomainPrefix,
  [string]$CallbackUrl = "https://luxnote.ai/workspace.html",
  [string]$LogoutUrl = "https://luxnote.ai/workspace.html",
  [string[]]$AdditionalCallbackUrls = @(),
  [string[]]$AdditionalLogoutUrls = @(),
  [switch]$UpdateConfig
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
  throw "AWS CLI was not found. Install AWS CLI v2 and run 'aws configure' or 'aws sso login' first."
}

$callbacks = @($CallbackUrl) + $AdditionalCallbackUrls
$logouts = @($LogoutUrl) + $AdditionalLogoutUrls

$poolInput = @{
  PoolName = $UserPoolName
  UsernameAttributes = @("email")
  AutoVerifiedAttributes = @("email")
  UsernameConfiguration = @{
    CaseSensitive = $false
  }
  AccountRecoverySetting = @{
    RecoveryMechanisms = @(
      @{
        Name = "verified_email"
        Priority = 1
      }
    )
  }
} | ConvertTo-Json -Depth 10

$poolFile = New-TemporaryFile
$clientFile = New-TemporaryFile

try {
  Set-Content -LiteralPath $poolFile -Value $poolInput -Encoding UTF8

  $pool = aws cognito-idp create-user-pool `
    --region $Region `
    --cli-input-json "file://$poolFile" |
    ConvertFrom-Json

  $userPoolId = $pool.UserPool.Id

  $clientInput = @{
    UserPoolId = $userPoolId
    ClientName = "LuxNotePrivateWorkspaceWeb"
    GenerateSecret = $false
    SupportedIdentityProviders = @("COGNITO")
    AllowedOAuthFlowsUserPoolClient = $true
    AllowedOAuthFlows = @("code")
    AllowedOAuthScopes = @("openid", "email", "profile")
    CallbackURLs = $callbacks
    LogoutURLs = $logouts
    ExplicitAuthFlows = @(
      "ALLOW_USER_SRP_AUTH",
      "ALLOW_REFRESH_TOKEN_AUTH"
    )
    PreventUserExistenceErrors = "ENABLED"
  } | ConvertTo-Json -Depth 10

  Set-Content -LiteralPath $clientFile -Value $clientInput -Encoding UTF8

  $client = aws cognito-idp create-user-pool-client `
    --region $Region `
    --cli-input-json "file://$clientFile" |
    ConvertFrom-Json

  aws cognito-idp create-user-pool-domain `
    --region $Region `
    --user-pool-id $userPoolId `
    --domain $DomainPrefix | Out-Null

  $domain = "https://$DomainPrefix.auth.$Region.amazoncognito.com"
  $clientId = $client.UserPoolClient.ClientId

  if ($UpdateConfig) {
    $configPath = Join-Path (Get-Location) "frontend\config-private.js"
    $config = Get-Content -LiteralPath $configPath -Raw
    $config = $config -replace 'cognitoDomain:\s*"[^"]*"', "cognitoDomain: `"$domain`""
    $config = $config -replace 'cognitoClientId:\s*"[^"]*"', "cognitoClientId: `"$clientId`""
    $config = $config -replace 'cognitoRedirectUri:\s*"[^"]*"', "cognitoRedirectUri: `"$CallbackUrl`""
    $config = $config -replace 'cognitoLogoutUri:\s*"[^"]*"', "cognitoLogoutUri: `"$LogoutUrl`""
    Set-Content -LiteralPath $configPath -Value $config -Encoding UTF8
  }

  Write-Host ""
  Write-Host "Cognito private workspace created."
  Write-Host "UserPoolId: $userPoolId"
  Write-Host "ClientId:   $clientId"
  Write-Host "Domain:     $domain"
  Write-Host ""
  Write-Host "config-private.js values:"
  Write-Host "  cognitoDomain: `"$domain`","
  Write-Host "  cognitoClientId: `"$clientId`","
  Write-Host ""
  Write-Host "Next: run tools\configure-private-api.ps1 with this UserPoolId and ClientId."
}
finally {
  Remove-Item -LiteralPath $poolFile,$clientFile -Force -ErrorAction SilentlyContinue
}
