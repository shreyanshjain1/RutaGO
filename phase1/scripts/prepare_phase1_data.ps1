param(
    [string]$SourceDir = ".\qc_subset",
    [string]$OutputDir = ".\phase1\data\prepared"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert-FileExists {
    param([string]$Path)
    if (-not (Test-Path $Path)) {
        throw "Missing required file: $Path"
    }
}

function Get-HeaderColumns {
    param([string]$Path)

    $line = Get-Content $Path -TotalCount 1
    return $line.Split(",") | ForEach-Object {
        $_.Trim().Trim('"') -replace "^`uFEFF", ""
    }
}

function Assert-Columns {
    param(
        [string]$Path,
        [string[]]$Required
    )

    $columns = Get-HeaderColumns -Path $Path
    foreach ($req in $Required) {
        if ($columns -notcontains $req) {
            throw "File '$Path' missing required column '$req'"
        }
    }
}

$routesPath = Join-Path $SourceDir "routes.txt"
$stopsPath = Join-Path $SourceDir "stops.txt"
$shapesPath = Join-Path $SourceDir "shapes.txt"
$tripsPath = Join-Path $SourceDir "trips.txt"

Assert-FileExists $routesPath
Assert-FileExists $stopsPath
Assert-FileExists $shapesPath
Assert-FileExists $tripsPath

Assert-Columns -Path $routesPath -Required @("route_id")
Assert-Columns -Path $stopsPath -Required @("stop_id", "stop_lat", "stop_lon")
Assert-Columns -Path $shapesPath -Required @("shape_id", "shape_pt_lat", "shape_pt_lon")
Assert-Columns -Path $tripsPath -Required @("trip_id", "route_id", "service_id")

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

Copy-Item $routesPath (Join-Path $OutputDir "routes.txt") -Force
Copy-Item $stopsPath (Join-Path $OutputDir "stops.txt") -Force
Copy-Item $tripsPath (Join-Path $OutputDir "trips.txt") -Force

# Keep additional GTFS files used by OTP graph build when available.
foreach ($optional in @("stop_times.txt", "calendar.txt", "calendar_dates.txt", "frequencies.txt", "shapes.txt", "agency.txt", "feed_info.txt")) {
    $src = Join-Path $SourceDir $optional
    if (Test-Path $src) {
        Copy-Item $src (Join-Path $OutputDir $optional) -Force
    }
}

$routesCount = (Import-Csv (Join-Path $OutputDir "routes.txt")).Count
$stopsCount = (Import-Csv (Join-Path $OutputDir "stops.txt")).Count
$tripsCount = (Import-Csv (Join-Path $OutputDir "trips.txt")).Count

Write-Output "Phase 1 data prepared."
Write-Output ("routes: {0}" -f $routesCount)
Write-Output ("stops: {0}" -f $stopsCount)
Write-Output ("trips: {0}" -f $tripsCount)
Write-Output ("output: {0}" -f (Resolve-Path $OutputDir))
