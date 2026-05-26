# UrbanAR — Bus Shelter Placement AR App

> An augmented reality web app for urban planning advocacy.  
> Point your phone at a SF bus stop → see proposed shelter designs → rate them → data feeds your thesis.

**Stack:** AR.js + A-Frame · GPS location-based AR · Google Sheets backend via Apps Script · GitHub Pages

---

## Table of Contents

1. [What it does](#what-it-does)
2. [File structure](#file-structure)
3. [Quick demo (no backend needed)](#quick-demo)
4. [Full setup](#full-setup)
   - [Google Sheets + Apps Script](#1-google-sheets--apps-script)
   - [Configure the app](#2-configure-the-app)
   - [Deploy to GitHub Pages](#3-deploy-to-github-pages)
5. [Adding / editing shelter proposals](#adding--editing-shelter-proposals)
6. [Fetching SF Muni stop data](#fetching-sf-muni-stop-data)
7. [Architecture](#architecture)
8. [Browser / device support](#browser--device-support)
9. [Thesis / research notes](#thesis--research-notes)

---

## What it does

| Feature | Detail |
|---------|--------|
| AR camera overlay | A-Frame + AR.js puts 3D shelter models at real GPS coordinates |
| GPS-activated | Proposals within ~300m appear automatically as you move |
| Tap to rate | Bottom sheet with 1–5 stars + comment field |
| Live stats | Average rating and count fetched from Google Sheets |
| Map view | Leaflet map showing all proposals with priority colors |
| Offline queue | Ratings saved to localStorage if offline, flushed on next load |
| GitHub Pages | 100% static — no server, no database cost |

---

## File Structure

```
thesis-urban-ar/
├── index.html          # AR camera view (main app)
├── map.html            # Leaflet map of all proposals
├── config.example.js   # Copy → config.js, add your GAS URL
├── css/
│   └── style.css
├── js/
│   ├── shelter-data.js # Static seed data + geo helpers
│   ├── sheets-api.js   # Thin wrapper around GAS webhook
│   └── app.js          # Core app logic (GPS, AR entities, rating panel)
├── gas/
│   └── Code.gs         # Google Apps Script Web App (copy into GAS editor)
├── data/
│   └── schema.md       # Full data schema documentation
├── assets/             # Place shelter render images here
└── .github/
    └── workflows/
        └── deploy.yml  # GitHub Actions → GitHub Pages
```

---

## Quick Demo

Works immediately without a backend — GPS falls back to SF Civic Center if unavailable.

```bash
# Serve locally (Python)
cd thesis-urban-ar
python3 -m http.server 8080
# Open http://localhost:8080 on your phone (same Wi-Fi) or desktop
```

> **Note:** Camera + GPS require HTTPS in production. `localhost` is exempt.  
> For mobile testing on local network, use ngrok or deploy to GitHub Pages.

Click **🏗 Demo** in the top bar to place a shelter at your current GPS position.  
Click **🗺 Map** to see all 5 SF proposals on an interactive map.

---

## Full Setup

### 1. Google Sheets + Apps Script

1. Create a new Google Spreadsheet (any name, e.g. "UrbanAR Data")
2. Open **Extensions → Apps Script**
3. Delete the default `Code.gs` content
4. Paste the contents of `gas/Code.gs`
5. **Run → seedSheltersSheet** (first time only) to create and populate the Shelters sheet
6. **Deploy → New deployment**
   - Type: **Web App**
   - Execute as: **Me**
   - Who has access: **Anyone** *(required for anonymous public ratings)*
7. Copy the deployment URL — it looks like:  
   `https://script.google.com/macros/s/AKfycbx.../exec`

### 2. Configure the App

```bash
cp config.example.js config.js
# Edit config.js:
# window.APP_CONFIG = { webhookUrl: 'https://script.google.com/macros/s/YOUR_ID/exec' }
```

Add `<script src="config.js"></script>` to `index.html` and `map.html` **before** `shelter-data.js`:

```html
<script src="config.js"></script>      <!-- add this line -->
<script src="js/shelter-data.js"></script>
```

### 3. Deploy to GitHub Pages

**Option A — Manual (simplest):**
1. Push repo to GitHub
2. Go to Settings → Pages → Source: `main` branch, `/ (root)`
3. Add `config.js` to your repo (or use Option B to keep the URL secret)

**Option B — GitHub Actions (webhook URL as secret):**
1. Go to Settings → Secrets → Actions → New repository secret
   - Name: `GAS_WEBHOOK_URL`
   - Value: your GAS deployment URL
2. Settings → Pages → Source: **GitHub Actions**
3. Push to `main` — the workflow in `.github/workflows/deploy.yml` auto-deploys

Your app will be live at `https://YOUR_USERNAME.github.io/thesis-urban-ar/`

> HTTPS is automatic on GitHub Pages — required for camera + GPS access on mobile.

---

## Adding / Editing Shelter Proposals

### Via Google Sheets (recommended)
Edit the `Shelters` sheet directly. Columns match the schema in `data/schema.md`.

### Via `shelter-data.js` (static fallback)
Edit `window.SHELTER_DATA` array. Used when Sheets is unreachable.

Design options: `solar` | `standard` | `ada-enhanced` | `green-roof`

---

## Fetching SF Muni Stop Data

### From 511.org GTFS (authoritative)
```bash
# Download GTFS
curl -L "https://api.511.org/transit/datafeeds?api_key=YOUR_511_KEY&operator_id=SF" -o sf-gtfs.zip
unzip sf-gtfs.zip stops.txt
# stops.txt has: stop_id, stop_name, stop_lat, stop_lon
```

Free API key: https://511.org/open-data/transit

### From SFMTA Open Data (Socrata)
```
https://data.sfgov.org/resource/cesy-gfp3.json?$limit=5000
```
Returns GeoJSON with stop geometry + attributes.

### Quick Python snippet to find stops near a coordinate:
```python
import json, math, urllib.request

def haversine(lat1, lng1, lat2, lng2):
    R = 6371000
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    dφ = math.radians(lat2-lat1)
    dλ = math.radians(lng2-lng1)
    a = math.sin(dφ/2)**2 + math.cos(φ1)*math.cos(φ2)*math.sin(dλ/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

# Stops near Mission & 16th St
center = (37.76454, -122.41964)
with urllib.request.urlopen('https://data.sfgov.org/resource/cesy-gfp3.json?$limit=5000') as r:
    stops = json.load(r)
nearby = [(s, haversine(*center, float(s['latitude']), float(s['longitude'])))
          for s in stops if 'latitude' in s]
nearby.sort(key=lambda x: x[1])
for stop, dist in nearby[:10]:
    print(f"{dist:.0f}m  {stop.get('stopname','?')}  id={stop.get('stopid','?')}")
```

---

## Architecture

```
Phone Browser (HTTPS)
        │
        ├── index.html + AR.js + A-Frame
        │     ├── GPS position → getSheltersNearby()
        │     ├── Inject <a-entity gps-entity-place> for each shelter
        │     └── Tap → open rating panel
        │
        ├── sheets-api.js
        │     └── fetch() → GAS Web App URL
        │
        └── Google Apps Script Web App
              ├── GET getShelters / getStats
              └── POST submitRating
                    └── Google Spreadsheet
                          ├── Shelters
                          ├── Ratings
                          └── Stats
```

**Why no server?**  
GitHub Pages is free and fast. Google Apps Script handles all writes. Zero infrastructure to maintain.

**GPS accuracy:**  
AR.js `gps-entity-place` positions entities at real-world GPS coordinates. On modern phones (iPhone 12+, Pixel 5+), accuracy is typically ±3–10m — sufficient for block-level shelter placement.

**AR technique:**  
Uses camera-based AR without marker tracking. Shelter models appear at GPS-fixed positions; device orientation (compass + gyroscope) determines which ones are visible. This is "world-scale AR" — similar to Pokémon GO.

---

## Browser / Device Support

| Platform | Browser | AR | GPS | Notes |
|----------|---------|----|----|-------|
| iOS 15+  | Safari  | ✅ | ✅ | Must allow camera + location |
| Android 10+ | Chrome | ✅ | ✅ | Best performance |
| Desktop Chrome | Chrome | ✅ (webcam) | ⚠️ | GPS via IP, inaccurate |
| Firefox | — | ⚠️ | ✅ | WebXR limited |

> Always test over HTTPS. `localhost` works for dev; deploy to Pages for real phone testing.

---

## Thesis / Research Notes

### Using this as a participation tool
- QR code → app URL → users scan at actual bus stops
- Data exports: Sheets → CSV → R/Python for analysis
- Map view (`map.html`) useful for presentations and planning meetings

### Suggested data analysis
```
- Distribution of ratings by design type
- Correlation between ridership (from GTFS) and rating scores  
- Priority hotspots: stops with >X ratings AND avg <3 (underserved + unhappy)
- Comment sentiment analysis (Python NLTK or OpenAI API)
```

### Citing data sources
- SFMTA stop data: © San Francisco Municipal Transportation Agency, CC BY
- 511.org GTFS: Metropolitan Transportation Commission
- Map tiles: © OpenStreetMap contributors, © CartoDB

### IRB / consent
If collecting public feedback for academic publication, consider adding a one-sentence consent notice before the first rating (e.g., as a modal on first load).

---

## License

MIT — use freely for academic and advocacy purposes.  
Attribution appreciated: *UrbanAR — [Your Name], [University], [Year]*
