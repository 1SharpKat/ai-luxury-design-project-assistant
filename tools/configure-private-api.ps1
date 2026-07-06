param(
  [string]$Region = "us-west-2",
  [string]$ApiId = "mqg99s0svc",
  [Parameter(Mandatory = $true)]
  [string]$UserPoolId,
  [Parameter(Mandatory = $true)]
  [string]$AppClientId,
  [Parameter(Mandatory = $true)]
  [string]$LambdaFunctionName,
  [string]$CoverPhotoBucket = "",
  [ValidateSet("true", "false")]
  [string]$PrivateAiEnabled = "false",
  [string]$AuthorizerName = "LuxNotePrivateWorkspaceAuthorizer",
  [string[]]$AllowedOrigins = @("https://luxnote.ai", "https://www.luxnote.ai")
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
  throw "AWS CLI was not found. Install AWS CLI v2 and run 'aws configure' or 'aws sso login' first."
}

$issuer = "https://cognito-idp.$Region.amazonaws.com/$UserPoolId"

$existingAuthorizers = aws apigatewayv2 get-authorizers `
  --region $Region `
  --api-id $ApiId |
  ConvertFrom-Json

$authorizer = $existingAuthorizers.Items |
  Where-Object { $_.Name -eq $AuthorizerName } |
  Select-Object -First 1

if (-not $authorizer) {
  $authorizer = aws apigatewayv2 create-authorizer `
    --region $Region `
    --api-id $ApiId `
    --authorizer-type JWT `
    --identity-source '$request.header.Authorization' `
    --name $AuthorizerName `
    --jwt-configuration "Audience=$AppClientId,Issuer=$issuer" |
    ConvertFrom-Json
}

$authorizerId = $authorizer.AuthorizerId
$routePairs = @(
  @{
    Public = "GET /project-notes"
    Private = "GET /private/project-notes"
  },
  @{
    Public = "POST /project-notes"
    Private = "POST /private/project-notes"
  },
  @{
    Public = "GET /project-notes/{recordId}"
    Private = "GET /private/project-notes/{recordId}"
  },
  @{
    Public = "DELETE /project-notes/{recordId}"
    Private = "DELETE /private/project-notes/{recordId}"
  },
  @{
    Public = "POST /project-cover-upload-url"
    Private = "POST /private/project-cover-upload-url"
  }
)

$routes = aws apigatewayv2 get-routes `
  --region $Region `
  --api-id $ApiId |
  ConvertFrom-Json

foreach ($pair in $routePairs) {
  $routeKey = $pair.Private
  $route = $routes.Items |
    Where-Object { $_.RouteKey -eq $routeKey } |
    Select-Object -First 1

  if (-not $route) {
    $publicRoute = $routes.Items |
      Where-Object { $_.RouteKey -eq $pair.Public } |
      Select-Object -First 1

    if (-not $publicRoute -or -not $publicRoute.Target) {
      Write-Warning "Public route target not found, so private route was skipped: $routeKey"
      continue
    }

    $route = aws apigatewayv2 create-route `
      --region $Region `
      --api-id $ApiId `
      --route-key $routeKey `
      --target $publicRoute.Target |
      ConvertFrom-Json
  }

  aws apigatewayv2 update-route `
    --region $Region `
    --api-id $ApiId `
    --route-id $route.RouteId `
    --authorization-type JWT `
    --authorizer-id $authorizerId | Out-Null
}

$lambdaConfig = aws lambda get-function-configuration `
  --region $Region `
  --function-name $LambdaFunctionName |
  ConvertFrom-Json

$variables = @{}

if ($lambdaConfig.Environment -and $lambdaConfig.Environment.Variables) {
  $lambdaConfig.Environment.Variables.PSObject.Properties |
    ForEach-Object {
      $variables[$_.Name] = [string]$_.Value
    }
}

$variables["REQUIRE_AUTH"] = "true"
$variables["PRIVATE_PATH_PREFIX"] = "/private"
$variables["PRIVATE_COVER_PHOTOS"] = "true"
$variables["ALLOW_EXTERNAL_COVER_URLS"] = "false"
$variables["ALLOW_PUBLIC_DELETE"] = "false"
$variables["PRIVATE_AI_ENABLED"] = $PrivateAiEnabled

if ($CoverPhotoBucket) {
  $variables["COVER_PHOTO_BUCKET"] = $CoverPhotoBucket
}

$environmentFile = New-TemporaryFile
$corsFile = New-TemporaryFile

try {
  @{
    AllowOrigins = $AllowedOrigins
    AllowMethods = @("GET", "POST", "DELETE", "OPTIONS")
    AllowHeaders = @("Authorization", "Content-Type")
  } | ConvertTo-Json -Depth 10 |
    Set-Content -LiteralPath $corsFile -Encoding UTF8

  aws apigatewayv2 update-api `
    --region $Region `
    --api-id $ApiId `
    --cors-configuration "file://$corsFile" |
    Out-Null

  @{
    Variables = $variables
  } | ConvertTo-Json -Depth 10 |
    Set-Content -LiteralPath $environmentFile -Encoding UTF8

  aws lambda update-function-configuration `
    --region $Region `
    --function-name $LambdaFunctionName `
    --environment "file://$environmentFile" |
    Out-Null
}
finally {
  Remove-Item -LiteralPath $environmentFile -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $corsFile -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Private API configuration complete."
Write-Host "API ID:       $ApiId"
Write-Host "Authorizer:   $AuthorizerName ($authorizerId)"
Write-Host "Issuer:       $issuer"
Write-Host "Lambda:       $LambdaFunctionName"
Write-Host "Private AI:   $PrivateAiEnabled"
Write-Host ""
Write-Host "Protected routes:"
$routePairs | ForEach-Object { Write-Host "  $($_.Private)" }
Write-Host ""
Write-Host "Unauthenticated public data routes are locked by Lambda auth."
Write-Host "Leave OPTIONS unauthenticated for CORS preflight."
