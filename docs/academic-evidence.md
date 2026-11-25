# Suggested academic evidence — GDS 187

These are screenshots for the student to capture and interpret personally. They are not claims that the student has completed these activities. Keep source names, DAUIDs, dates and relevant context visible. Cite data and software, and follow course requirements for acknowledging assistance.

| Evidence | Suggested capture | What to explain yourself |
| --- | --- | --- |
| Original data inspection | Open source GeoPackage layer in QGIS; show layer CRS and attribute table. | Why the file is the analytical source; identify its population and coverage fields. |
| Preparation script | Show input arguments, validation and export sections in `scripts/prepare_data.py`. | How one command reproduces exports without altering originals. |
| CRS transformation | Show source EPSG:26917 and output EPSG:4326 properties or the `to_crs` operation. | Metres versus degrees; transformation versus relabelling. |
| Validation results | Show `docs/data-validation.md` and its statistical comparison. | Which targets matched, which could not be verified, and the limits of the checks. |
| GeoJSON structure | Open a real Feature in an editor with DAUID, geometry type and properties visible. | FeatureCollection → Feature → geometry/properties; longitude-first coordinates. |
| MapLibre implementation | Show source registration and fill/line layer definitions in `src/`. | One dataset can be rendered through several layers. |
| Choropleth | Capture the regional map with legend and source attribution visible. | Selected 800 m percentage measure, class endpoints, missing colour and estimation assumptions. |
| Interactive popup | Click a DA and capture its DAUID and estimated population values. | Cross-check the same ID in the original table; explain display rounding. |
| Layer controls | Capture the same extent before/after toggling priority or choropleth. | How visibility changes presentation without changing data. |
| Recovery limitations | Capture the GTFS recovery status and missing-layer message. | Why historical service cannot be replaced silently with a current feed. |

Prefer your own screenshots of the running application and your own terminal/QGIS session. Record the date and source commit alongside evidence. Do not describe agent-produced screenshots or automated checks as work you personally performed. Public sharing should wait for the documented data attribution/licensing review.

## Phase 3 screenshot checklist

Capture these personally and add your own interpretation; automated screenshots or checks do not demonstrate personal participation.

- [ ] Official GRT open-data page and the bus/LRT download links; record the retrieval date.
- [ ] Original ZIP table inventory and sources.json with calendar spans and checksums.
- [ ] prepare_gtfs.py: calendar filtering, event counting and projected buffer operations.
- [ ] gtfs-validation.md and successful test output, including known limitations.
- [ ] Transit stops at a useful local scale with official source attribution.
- [ ] Frequency colours and their High/Moderate/Low/No service legend.
- [ ] Each of 400 m, 800 m and High-frequency 400 m coverage, preferably one at a time.
- [ ] A transit stop popup with its name, ID, departures, routes and service date.
- [ ] A route popup showing the selected service date and actual route name.
- [ ] The dynamic legend before/after hiding stops or switching frequency colouring.
- [ ] The data information panel showing historical versus newly downloaded network dates.

Do not caption the new buffers as the original historical accessibility input. Explain that they are straight-line proximity, not walking distances or verified current population access. The original high-frequency population figure remains unverified.

## Phase 4 screenshot and interpretation guide

The agent observed the original Phase 3 interface in a browser at 1440 × 900 before editing. That observation is recorded in [phase4-audit.md](phase4-audit.md); it does not by itself establish that a before-image was saved. Only use an image file as saved evidence when the final verification record identifies it. Label any agent-captured image **Automatically generated development evidence**, with its date, viewport and interface state. Such images demonstrate the application, not the student's personal participation.

| Screenshot | Suggested state and required context | Interpretation to write personally |
| --- | --- | --- |
| Before: Phase 3 | Existing sidebar/map at 1440 × 900; use the actual archived before-image if available | Which controls or explanations required scrolling, and how that affected exploration |
| Redesigned dashboard | 1440 × 900 or 1920 × 1080, regional selection, overview statistics and map visible | Information hierarchy and why the map remains primary |
| Historical accessibility choropleth | Historical fill active; readable percentage legend and historical date | Ordered classes, area-weighted estimates and straight-line-distance limits |
| Transit network | Stops/frequency or routes visible; service date and network legend | Scheduled snapshot versus live transit and historical population results |
| Feature information | Select an actual DA, stop or route and retain its identifier/date | Verify one displayed value against the exported feature; explain units |
| Layer controls | Show logical groups and one before/after visibility change | Source versus rendering layer; corresponding legend update |
| Municipality comparison | Show seven labelled population-weighted rates and a selected municipality | Why ratios of summed populations are used rather than average DA percentages |
| Methodology | Open the actual functional view with buffer and estimation explanations | One analytical assumption and its consequence |
| Data Sources | Show actual dataset providers, dates and limitations | Why download date, service date and Census year are different |
| Mobile layout | 390 × 844, both map-first and analytics drawer states if available | Touch targets, available map area, close controls and information trade-offs |

- [ ] Record the exact viewport, selected municipality and visible layers for each image.
- [ ] Include visible source/date context when the image makes an analytical claim.
- [ ] Pair before/after images at the same extent and viewport where feasible; identify differences otherwise.
- [ ] Identify who captured each image and distinguish automated tests from personal exploration.
- [ ] Do not label a requested viewport as tested until actual browser inspection is recorded.
- [ ] Describe remaining limitations and personally observed usability issues honestly.

Do not recreate a newly styled page and caption it as the original Phase 3 screenshot. If no before-image was saved, use the written baseline audit and say the image is unavailable. No public deployment is part of Phase 4.

## Phase 4 screenshot guide

All browser checks by the coding agent are automated development evidence, not personal student activities. Before/after images were observed inline during browser inspection; standalone image files were not saved in this phase. The Phase 3 UI source copies are retained in workspace work/ for reference.

Capture these report images personally and annotate the scope/date:
- Original Phase 3 interface from prior browser evidence, labelled before redesign.
- Full redesigned desktop dashboard with historical KPI cards and map legend.
- Choropleth with the historical date visible and network stops hidden.
- Current network with frequency legend and snapshot date.
- A selected DA or transit route in the contextual information panel.
- Grouped layer controls and an active buffer legend.
- Municipality comparison plus matching selector/KPIs (avoid mixing regional totals).
- Methodology dialog and separate Data Sources dialog.
- 390×844 mobile map and open analytics drawer.

Do not label the current buffers as historical replication, scheduled departures as live arrivals, or straight-line proximity as walking accessibility.

## Phase 5 evidence

Automatically generated export samples are under docs/evidence/: phase5-map-export.png (map canvas + attribution, no UI panels), phase5-municipalities.csv and phase5-route19.csv. Browser before/after screenshots were inspected inline, but standalone UI screenshots were not saved.

Suggested personal report screenshots: Overview KPIs with dated provenance; Layers tab with the clean default; Compare rankings for400m and800m; search suggestions and selected DA/stop; highlighted route; opacity and basemap controls; a CSV opened with identifier columns imported as text; PNG attribution footer;390×844mobile map and analytics tabs. Distinguish automated evidence from your own exploration and reflections.
