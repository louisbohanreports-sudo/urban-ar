# UrbanAR — Data Schema Documentation

## Overview

All data flows through three Google Sheets and a Google Apps Script Web App.
The frontend (static GitHub Pages) communicates exclusively via the GAS webhook — no direct Sheets API calls.

---

## Sheets

### 1. `Shelters`
Master list of bus shelter proposals. Seeded via `seedSheltersSheet()` in Code.gs.
Updated manually by the urban planner / thesis researcher.

| Column      | Type   | Description                                      | Example                    |
|-------------|--------|--------------------------------------------------|----------------------------|
| id          | string | Unique internal ID                               | `shelter-001`              |
| stop_id     | string | SFMTA GTFS stop_id (from 511.org feed)           | `15552`                    |
| name        | string | Human-readable stop name                         | `Mission St & 16th St`     |
| lat         | float  | WGS-84 latitude                                  | `37.76454`                 |
| lng         | float  | WGS-84 longitude                                 | `-122.41964`               |
| routes      | JSON   | Array of Muni route tags                         | `["14","14R","49"]`        |
| design      | enum   | `solar` / `standard` / `ada-enhanced` / `green-roof` | `solar`               |
| description | string | Proposal summary for display in panel            | "High-ridership corner…"   |
| priority    | int    | 1=High, 2=Medium, 3=Low                          | `1`                        |
| imageUrl    | string | Optional render/photo URL                        | `https://…`                |

---

### 2. `Ratings`
One row per user submission. Append-only; never modified after write.

| Column      | Type     | Description                                      | Example                        |
|-------------|----------|--------------------------------------------------|--------------------------------|
| shelterId   | string   | FK → Shelters.id                                 | `shelter-001`                  |
| stopId      | string   | SFMTA stop_id (denormalized for analysis)        | `15552`                        |
| stopName    | string   | Stop name at time of submission                  | `Mission St & 16th St`         |
| rating      | int      | 1–5 star rating                                  | `4`                            |
| comment     | string   | Optional free-text feedback (max 500 chars)      | "Great location for solar"     |
| lat         | float    | User GPS latitude at submission time             | `37.76501`                     |
| lng         | float    | User GPS longitude at submission time            | `-122.41988`                   |
| timestamp   | ISO 8601 | UTC timestamp of submission                      | `2024-09-15T18:23:11.000Z`     |
| userAgent   | string   | Browser/device string (anonymized analytics)     | `Mozilla/5.0 (iPhone; …)`      |

---

### 3. `Stats`
Auto-maintained aggregate table. Rebuilt on every `submitRating` call.

| Column      | Type     | Description                                      |
|-------------|----------|--------------------------------------------------|
| shelterId   | string   | FK → Shelters.id                                 |
| avg         | float    | Average rating (rounded to 1 decimal)            |
| count       | int      | Total number of ratings                          |
| lastUpdated | ISO 8601 | Timestamp of last stats rebuild                  |

---

## API Endpoints

All requests go to the GAS Web App URL (stored as `APP_CONFIG.webhookUrl`).

### `GET ?action=getShelters`
Returns all shelter proposals with live stats attached.
```json
{
  "ok": true,
  "shelters": [
    {
      "id": "shelter-001",
      "stop_id": "15552",
      "name": "Mission St & 16th St",
      "lat": 37.76454,
      "lng": -122.41964,
      "routes": ["14","14R","49"],
      "design": "solar",
      "description": "…",
      "priority": 1,
      "avg": 4.2,
      "count": 18
    }
  ]
}
```

### `GET ?action=getStats&shelterId=shelter-001`
Returns aggregate + recent comments for one shelter.
```json
{
  "ok": true,
  "shelterId": "shelter-001",
  "count": 18,
  "avg": 4.2,
  "comments": [
    { "comment": "Love the solar idea", "timestamp": "2024-09-15T18:23:11.000Z" }
  ]
}
```

### `POST` `{ action: "submitRating", ... }`
Appends a rating row and rebuilds Stats.
```json
// Request body
{
  "action": "submitRating",
  "shelterId": "shelter-001",
  "stopId": "15552",
  "stopName": "Mission St & 16th St",
  "rating": 5,
  "comment": "This corner desperately needs a shelter!",
  "lat": 37.76501,
  "lng": -122.41988,
  "timestamp": "2024-09-15T18:23:11.000Z",
  "userAgent": "Mozilla/5.0 (iPhone; …)"
}
// Response
{ "ok": true, "message": "Rating recorded" }
```

---

## SF Muni / GTFS Data Sources

| Source | URL | Notes |
|--------|-----|-------|
| 511.org GTFS | `https://511.org/open-data/transit` | Full GTFS feed for SFMTA (stops.txt has all stop IDs + coordinates) |
| SFMTA Open Data | `https://data.sfgov.org/Transportation/SFMTA-Bus-Stops/cesy-gfp3` | Socrata endpoint, GeoJSON available |
| NextBus / 511 RT | `https://api.511.org/transit/StopMonitoring` | Real-time arrivals (requires free API key) |

**Importing stops from GTFS:**
1. Download GTFS zip from 511.org
2. Extract `stops.txt` (CSV)
3. Filter `stop_name` for desired corridors
4. Paste stop_id, stop_lat, stop_lon into Shelters sheet

---

## Design Variants

| design       | Color (AR)  | Description                                           |
|--------------|-------------|-------------------------------------------------------|
| solar        | #ffd60a 🟡  | Solar panels, USB charging, digital arrival display   |
| standard     | #30d158 🟢  | Extended roof, improved lighting, benches             |
| ada-enhanced | #64d2ff 🔵  | Wide boarding zone, tactile paving, audio system      |
| green-roof   | #32d74b 🟢  | Living roof, planting, integrated seating             |

---

## Privacy Notes

- No user accounts required
- GPS coordinates captured only at submission time, not continuously tracked
- No PII collected; userAgent is for device analytics only
- All data is researcher-controlled in a private Google Spreadsheet
- Users should be informed via a brief consent note before first rating (add to index.html)
