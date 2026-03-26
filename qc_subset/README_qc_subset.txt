Quezon City GTFS subset

How this subset was created
- Source: parent GTFS tables in this folder.
- Route selection keeps routes that satisfy either:
  1) at least one trip has a stop in Quezon City by stop_name text match (contains "Quezon City")
  2) at least one trip has a stop inside an approximate QC bounding box:
     lat 14.58 to 14.80, lon 120.99 to 121.12
  3) route text includes "Quezon City" in route_long_name or route_desc

Referential filtering
- trips.txt filtered by selected route_id
- stop_times.txt filtered by selected trip_id
- stops.txt filtered by selected stop_id from stop_times
- frequencies.txt filtered by selected trip_id
- calendar.txt filtered by selected service_id from trips
- shapes.txt filtered by selected shape_id from trips
- agency.txt filtered by selected fagency_id from routes
- feed_info.txt copied as-is

Generated counts (current run)
- routes: 1155
- trips: 1269
- stop_times: 62000
- stops: 3648
- shapes: 507
- frequencies: 1269
- calendar: 10
- agency: 4

Re-run command
- .\extract_qc_subset.ps1 -InputDir . -OutputDir .\qc_subset
