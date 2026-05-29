# WMS Agent installer for Windows (NSSM / Windows Service)
param(
  [Parameter(Mandatory)][string]$WmsServerUrl,
  [Parameter(Mandatory)][string]$WmsEnrollToken,
  [string]$InstallDir = "C:\Program Files\WmsAgent",
  [string]$StateDir   = "C:\ProgramData\WmsAgent"
)

$ErrorActionPreference = "Stop"
$ServiceName = "WmsAgent"
$Binary = "wms-agent.exe"

Write-Host "==> Installing WMS Agent (Windows)"

# Build binary (requires Go in PATH)
$AgentSrc = Join-Path $PSScriptRoot "..\..\"
Push-Location $AgentSrc
go build -o "$env:TEMP\$Binary" .
Pop-Location

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
New-Item -ItemType Directory -Force -Path $StateDir   | Out-Null
Copy-Item "$env:TEMP\$Binary" "$InstallDir\$Binary" -Force

# Use NSSM if available, otherwise sc.exe
if (Get-Command nssm -ErrorAction SilentlyContinue) {
  nssm install $ServiceName "$InstallDir\$Binary"
  nssm set $ServiceName AppEnvironmentExtra `
    "WMS_SERVER_URL=$WmsServerUrl" `
    "WMS_ENROLL_TOKEN=$WmsEnrollToken" `
    "WMS_STATE_FILE=$StateDir\state.json" `
    "WMS_INTERVAL=10s"
  nssm set $ServiceName Start SERVICE_AUTO_START
  nssm start $ServiceName
} else {
  # Fallback: create scheduled task that runs at startup
  $action  = New-ScheduledTaskAction -Execute "$InstallDir\$Binary"
  $trigger = New-ScheduledTaskTrigger -AtStartup
  $settings= New-ScheduledTaskSettingsSet -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1)
  $envVars = @(
    "WMS_SERVER_URL=$WmsServerUrl",
    "WMS_ENROLL_TOKEN=$WmsEnrollToken",
    "WMS_STATE_FILE=$StateDir\state.json",
    "WMS_INTERVAL=10s"
  )
  $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
  Register-ScheduledTask -TaskName $ServiceName -Action $action -Trigger $trigger `
    -Settings $settings -Principal $principal -Force | Out-Null

  # Set environment for the task
  $task = Get-ScheduledTask -TaskName $ServiceName
  $task.Actions[0].Arguments = ""
  foreach ($env in $envVars) {
    [Environment]::SetEnvironmentVariable($env.Split("=")[0], $env.Split("=",2)[1], "Machine")
  }
  Start-ScheduledTask -TaskName $ServiceName
}

Write-Host "==> WMS Agent installed and started."
Write-Host "    Check status: Get-Service $ServiceName  (or Get-ScheduledTask $ServiceName)"
