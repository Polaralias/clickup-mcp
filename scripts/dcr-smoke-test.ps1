# DCR Smoke Test Script
param(
    [string]$BaseUrl = "http://localhost:3011"
)

$RedirectUri = "https://oauth.pstmn.io/v1/callback"

# 1. Register Client
Write-Host "1. Registering client..." -ForegroundColor Cyan
$RegBody = @{
    redirect_uris              = @($RedirectUri)
    client_name                = "Smoke Test Client"
    token_endpoint_auth_method = "none"
} | ConvertTo-Json

$RegRes = Invoke-RestMethod -Uri "$BaseUrl/register" -Method Post -Body $RegBody -ContentType "application/json"
$ClientId = $RegRes.client_id
Write-Host "Generated Client ID: $ClientId" -ForegroundColor Green

# 2. Start Connect Flow (Manual Step)
$State = [guid]::NewGuid().ToString()
$CodeVerifier = "thisshouldbealongrandomstringthathasenoughbitsofentropy"
$Bytes = [System.Text.Encoding]::UTF8.GetBytes($CodeVerifier)
$Hash = [System.Security.Cryptography.SHA256]::Create().ComputeHash($Bytes)
$CodeChallenge = [Convert]::ToBase64String($Hash).TrimEnd('=').Replace('+', '-').Replace('/', '_')

$ConnectUrl = "$BaseUrl/connect?client_id=$ClientId&redirect_uri=$RedirectUri&state=$State&code_challenge=$CodeChallenge&code_challenge_method=S256"

Write-Host "`n2. Open the following URL in your browser and complete the connection:" -ForegroundColor Cyan
Write-Host $ConnectUrl -ForegroundColor Yellow

$AuthCode = Read-Host "`nAfter redirecting, copy the 'code' parameter from the URL and paste it here"

# 3. Exchange Token
Write-Host "`n3. Exchanging code for token..." -ForegroundColor Cyan
$TokenBody = @{
    grant_type    = "authorization_code"
    code          = $AuthCode
    redirect_uri  = $RedirectUri
    code_verifier = $CodeVerifier
    client_id     = $ClientId
} | ConvertTo-Json

$TokenRes = Invoke-RestMethod -Uri "$BaseUrl/token" -Method Post -Body $TokenBody -ContentType "application/json"
$AccessToken = $TokenRes.access_token
Write-Host "Received Access Token: $AccessToken" -ForegroundColor Green

# 4. Call MCP tools/list
Write-Host "`n4. Calling POST /mcp tools/list..." -ForegroundColor Cyan
$McpBody = @{
    method = "tools/list"
    params = @{}
} | ConvertTo-Json

$McpRes = Invoke-RestMethod -Uri "$BaseUrl/mcp" -Method Post -Body $McpBody -ContentType "application/json" -Headers @{ Authorization = "Bearer $AccessToken" }
Write-Host "MCP Response:" -ForegroundColor Green
$McpRes | ConvertTo-Json -Depth 10
