# OpenTripPlanner Setup

## Prerequisites

- Java 17+
- `otp.jar` downloaded and placed in this folder as `otp.jar`

## Build Graph

From this folder:

```powershell
java -jar .\otp.jar --build ..\data\prepared
```

## Serve OTP

```powershell
java -jar .\otp.jar --serve ..\data\prepared
```

Default endpoint:
- `http://localhost:8080/otp/routers/default/plan`

Example test:

```text
http://localhost:8080/otp/routers/default/plan?fromPlace=14.6535,121.049&toPlace=14.5995,120.984&mode=TRANSIT,WALK
```
