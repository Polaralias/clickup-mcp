# Smoke Test Script for ClickUp MCP Server
#
# This script verifies the authentication flow and basic MCP functionality.
#
# Usage:
# 1. Run the server (e.g., via docker-compose up).
# 2. Open a browser and go to http://localhost:3011/connect (or your server URL).
# 3. Complete the connection form.
#    - You will need a valid ClickUp API Key.
#    - Use a redirect URI like http://localhost:3000/callback
# 4. Upon redirection, copy the 'code' parameter from the URL.
# 5. Run this script.
#
# Note: You need the 'code_verifier' used during the connect flow.
# Since the browser flow handles PKCE automatically, you might need to use a tool like Postman
# or manually generate the PKCE challenge/verifier pair to get the verifier if you are testing manually.
#
# If you used the standard /connect UI in the browser, the code_verifier is stored in the browser session or handled by the client.
# FOR THIS TEST: You may need to manually simulate the /connect step or assume you have a valid code and verifier.
#
# However, for a "smoke test", we can simulate the client side here if we want to do the full flow,
# BUT the prompt says: "Step 1: do /connect in browser (manual) ... Step 2: run the script and paste code + verifier".
# This implies the user must know the verifier.
# The standard /connect UI does NOT expose the verifier to the user easily (it's handled by the client app).
#
# IF YOU CANNOT GET THE VERIFIER FROM THE BROWSER:
# You can use the `state` parameter or just use this script to call /token if you have the values.
#
# To make this easier for testing without a real OAuth client, you can use a fixed verifier and challenge if you manually construct the URL.
#
# Example manual URL construction for testing:
# http://localhost:3011/connect?redirect_uri=http://localhost:3000/callback&code_challenge=YOUR_CHALLENGE&code_challenge_method=S256
# Then you know the verifier corresponding to YOUR_CHALLENGE.

param (
    [string]$BaseUrl = "http://localhost:3011",
    [string]$RedirectUri = "http://localhost:3000/callback"
)

# Helper for PKCE (if we wanted to generate it, but we are prompting)
# We will just prompt for inputs.

$BaseUrl = Read-Host "Enter Base URL (default: http://localhost:3011)"
if ([string]::IsNullOrWhiteSpace($BaseUrl)) { $BaseUrl = "http://localhost:3011" }

$Code = Read-Host "Enter Authorization Code (from redirect URL)"
$Verifier = Read-Host "Enter Code Verifier (PKCE verifier)"

Write-Host "`nStep 1: Exchanging code for token..." -ForegroundColor Cyan

$TokenBody = @{
    grant_type = "authorization_code"
    code = $Code
    redirect_uri = $RedirectUri
    code_verifier = $Verifier
}

try {
    $TokenResponse = Invoke-RestMethod -Uri "$BaseUrl/token" -Method Post -Body ($TokenBody | ConvertTo-Json) -ContentType "application/json"
    $AccessToken = $TokenResponse.access_token

    if (-not $AccessToken) {
        Write-Error "Failed to get access token. Response: $($TokenResponse | ConvertTo-Json)"
        exit 1
    }

    Write-Host "Success! Access Token received." -ForegroundColor Green
    # Write-Host "Token: $AccessToken" # Don't log secrets in production, but useful for debug

} catch {
    Write-Error "Token exchange failed: $_"
    exit 1
}

Write-Host "`nStep 2: Testing MCP endpoint..." -ForegroundColor Cyan

$Headers = @{
    "Authorization" = "Bearer $AccessToken"
    "Content-Type" = "application/json"
}

$McpBody = @{
    jsonrpc = "2.0"
    method = "tools/list"
    id = 1
}

try {
    $McpResponse = Invoke-RestMethod -Uri "$BaseUrl/mcp" -Method Post -Headers $Headers -Body ($McpBody | ConvertTo-Json)

    if ($McpResponse.result) {
         Write-Host "Success! MCP tools list received." -ForegroundColor Green
         $ToolCount = $McpResponse.result.tools.Count
         Write-Host "Found $ToolCount tools."
    } else {
         Write-Error "MCP response invalid. Response: $($McpResponse | ConvertTo-Json)"
         exit 1
    }

} catch {
    Write-Error "MCP call failed: $_"
    exit 1
}

Write-Host "`nSmoke test PASSED." -ForegroundColor Green
