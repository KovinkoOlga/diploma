param(
  [int]$BackendPort = 8000,
  [string]$IpAddress = ""
)

$ErrorActionPreference = "Stop"

function Get-LanIPv4Address {
  $primaryAddresses = Get-NetIPConfiguration |
    Where-Object {
      $_.IPv4DefaultGateway -ne $null -and
      $_.NetAdapter.Status -eq "Up" -and
      $_.IPv4Address -ne $null
    } |
    ForEach-Object { $_.IPv4Address.IPAddress } |
    Where-Object {
      $_ -and
      $_ -notlike "127.*" -and
      $_ -notlike "169.254.*"
    }

  if ($primaryAddresses) {
    return @($primaryAddresses)[0]
  }

  $fallbackAddresses = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object {
      $_.IPAddress -notlike "127.*" -and
      $_.IPAddress -notlike "169.254.*" -and
      $_.PrefixOrigin -ne "WellKnown"
    } |
    Sort-Object -Property InterfaceMetric |
    Select-Object -ExpandProperty IPAddress

  if ($fallbackAddresses) {
    return @($fallbackAddresses)[0]
  }

  throw "Could not detect a LAN IPv4 address. Pass it manually: .\start-lan.ps1 -IpAddress 192.168.1.23"
}

$clientDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$detectedIp = if ($IpAddress) { $IpAddress } else { Get-LanIPv4Address }
$env:EXPO_PUBLIC_API_URL = "http://${detectedIp}:${BackendPort}"

Write-Host "EXPO_PUBLIC_API_URL=$env:EXPO_PUBLIC_API_URL"
Write-Host "Starting Expo with cleared cache..."

Push-Location $clientDir
try {
  & npx expo start -c
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
