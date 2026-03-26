param(
    [string]$InputDir = ".",
    [string]$OutputDir = ".\qc_subset"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function To-HashSet {
    param([Parameter(ValueFromPipeline = $true)][string[]]$Values)
    begin { $set = New-Object "System.Collections.Generic.HashSet[string]" }
    process {
        foreach ($v in $Values) {
            if (-not [string]::IsNullOrWhiteSpace($v)) {
                [void]$set.Add($v)
            }
        }
    }
    end { return ,$set }
}

function Get-ColumnName {
    param(
        [Parameter(Mandatory = $true)][object[]]$Rows,
        [Parameter(Mandatory = $true)][string]$ColumnHint
    )

    if ($Rows.Count -eq 0) {
        return $ColumnHint
    }

    $names = $Rows[0].PSObject.Properties.Name
    $match = $names | Where-Object { ($_ -replace "^`uFEFF", "") -eq $ColumnHint } | Select-Object -First 1
    if ($null -ne $match) {
        return $match
    }

    return $ColumnHint
}

function Get-RowCount {
    param([object]$Rows)
    if ($null -eq $Rows) { return 0 }
    return @($Rows).Count
}

function Is-InQcBbox {
    param([object]$Stop)

    if ([string]::IsNullOrWhiteSpace($Stop.stop_lat) -or [string]::IsNullOrWhiteSpace($Stop.stop_lon)) {
        return $false
    }

    try {
        $lat = [double]$Stop.stop_lat
        $lon = [double]$Stop.stop_lon
    } catch {
        return $false
    }

    # Approximate Quezon City bounds to catch routes that do not include city names in stop text.
    return ($lat -ge 14.58 -and $lat -le 14.80 -and $lon -ge 120.99 -and $lon -le 121.12)
}

$routesPath = Join-Path $InputDir "routes.txt"
$tripsPath = Join-Path $InputDir "trips.txt"
$stopTimesPath = Join-Path $InputDir "stop_times.txt"
$stopsPath = Join-Path $InputDir "stops.txt"
$calendarPath = Join-Path $InputDir "calendar.txt"
$frequenciesPath = Join-Path $InputDir "frequencies.txt"
$shapesPath = Join-Path $InputDir "shapes.txt"
$agencyPath = Join-Path $InputDir "agency.txt"
$feedInfoPath = Join-Path $InputDir "feed_info.txt"

$routes = Import-Csv $routesPath
$trips = Import-Csv $tripsPath
$stopTimes = Import-Csv $stopTimesPath
$stops = Import-Csv $stopsPath
$calendar = Import-Csv $calendarPath
$frequencies = Import-Csv $frequenciesPath
$shapes = Import-Csv $shapesPath
$agency = Import-Csv $agencyPath
$feedInfo = Import-Csv $feedInfoPath

$shapeIdColumnInShapes = Get-ColumnName -Rows $shapes -ColumnHint "shape_id"
$serviceIdColumnInCalendar = Get-ColumnName -Rows $calendar -ColumnHint "service_id"
$agencyIdColumnInAgency = Get-ColumnName -Rows $agency -ColumnHint "agency_id"

$qcStops = $stops | Where-Object { ($_.stop_name -match "Quezon City") -or (Is-InQcBbox $_) }
$qcStopIdSet = ($qcStops | Select-Object -ExpandProperty stop_id) | To-HashSet

$tripIdsTouchingQc = New-Object "System.Collections.Generic.HashSet[string]"
foreach ($st in $stopTimes) {
    if ($qcStopIdSet.Contains($st.stop_id)) {
        [void]$tripIdsTouchingQc.Add($st.trip_id)
    }
}

$routeIdsFromQcStops = ($trips | Where-Object { $tripIdsTouchingQc.Contains($_.trip_id) } | Select-Object -ExpandProperty route_id -Unique) | To-HashSet
$routeIdsFromRouteText = ($routes | Where-Object { ($_.route_long_name -match "Quezon City") -or ($_.route_desc -match "Quezon City") } | Select-Object -ExpandProperty route_id -Unique) | To-HashSet

$selectedRouteIds = New-Object "System.Collections.Generic.HashSet[string]"
foreach ($rid in $routeIdsFromQcStops) { [void]$selectedRouteIds.Add($rid) }
foreach ($rid in $routeIdsFromRouteText) { [void]$selectedRouteIds.Add($rid) }

$routesFiltered = $routes | Where-Object { $selectedRouteIds.Contains($_.route_id) }
$tripsFiltered = $trips | Where-Object { $selectedRouteIds.Contains($_.route_id) }
$tripIdSet = ($tripsFiltered | Select-Object -ExpandProperty trip_id -Unique) | To-HashSet

$stopTimesFiltered = $stopTimes | Where-Object { $tripIdSet.Contains($_.trip_id) }
$stopIdSet = ($stopTimesFiltered | Select-Object -ExpandProperty stop_id -Unique) | To-HashSet
$stopsFiltered = $stops | Where-Object { $stopIdSet.Contains($_.stop_id) }

$serviceIdSet = ($tripsFiltered | Select-Object -ExpandProperty service_id -Unique) | To-HashSet
$calendarFiltered = $calendar | Where-Object { $serviceIdSet.Contains($_.$serviceIdColumnInCalendar) }

$frequenciesFiltered = $frequencies | Where-Object { $tripIdSet.Contains($_.trip_id) }

$shapeIdSet = ($tripsFiltered | Where-Object { -not [string]::IsNullOrWhiteSpace($_.shape_id) } | Select-Object -ExpandProperty shape_id -Unique) | To-HashSet
if ($null -ne $shapeIdSet -and $shapeIdSet.Count -gt 0) {
    $shapesFiltered = $shapes | Where-Object { $shapeIdSet.Contains($_.$shapeIdColumnInShapes) }
} else {
    $shapesFiltered = @()
}

$agencyIdSet = ($routesFiltered | Where-Object { -not [string]::IsNullOrWhiteSpace($_.fagency_id) } | Select-Object -ExpandProperty fagency_id -Unique) | To-HashSet
if ($null -ne $agencyIdSet -and $agencyIdSet.Count -gt 0) {
    $agencyFiltered = $agency | Where-Object { $agencyIdSet.Contains($_.$agencyIdColumnInAgency) }
} else {
    $agencyFiltered = @()
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$agencyFiltered | Export-Csv (Join-Path $OutputDir "agency.txt") -NoTypeInformation -Encoding UTF8
$calendarFiltered | Export-Csv (Join-Path $OutputDir "calendar.txt") -NoTypeInformation -Encoding UTF8
$feedInfo | Export-Csv (Join-Path $OutputDir "feed_info.txt") -NoTypeInformation -Encoding UTF8
$frequenciesFiltered | Export-Csv (Join-Path $OutputDir "frequencies.txt") -NoTypeInformation -Encoding UTF8
$routesFiltered | Export-Csv (Join-Path $OutputDir "routes.txt") -NoTypeInformation -Encoding UTF8
$shapesFiltered | Export-Csv (Join-Path $OutputDir "shapes.txt") -NoTypeInformation -Encoding UTF8
$stopsFiltered | Export-Csv (Join-Path $OutputDir "stops.txt") -NoTypeInformation -Encoding UTF8
$stopTimesFiltered | Export-Csv (Join-Path $OutputDir "stop_times.txt") -NoTypeInformation -Encoding UTF8
$tripsFiltered | Export-Csv (Join-Path $OutputDir "trips.txt") -NoTypeInformation -Encoding UTF8

Write-Output "Created QC subset in: $OutputDir"
Write-Output ("routes: {0}" -f $routesFiltered.Count)
Write-Output ("trips: {0}" -f $tripsFiltered.Count)
Write-Output ("stop_times: {0}" -f $stopTimesFiltered.Count)
Write-Output ("stops: {0}" -f $stopsFiltered.Count)
Write-Output ("shapes: {0}" -f $shapesFiltered.Count)
Write-Output ("frequencies: {0}" -f $frequenciesFiltered.Count)
Write-Output ("calendar: {0}" -f (Get-RowCount $calendarFiltered))
Write-Output ("agency: {0}" -f (Get-RowCount $agencyFiltered))
