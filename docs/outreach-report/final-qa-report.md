# Final QA report

Release checks: November 25, 2026. Local application: Vite at 127.0.0.1:5174. Public deployment verification is pending. This is targeted Chromium/browser-tool QA, not a cross-browser or WCAG certification. Prior Phase 5 observations are explicitly identified rather than represented as new tests.

| Test | Expected | Observed | Status | Issue / corrective action |
|---|---|---|---|---|
| Fresh load/map | Historical data and map initialize | 587,165 residents, 766 DAs, 52 priority; street tiles and polygons visible | Pass | Old HMR tab was still loading; fresh reload succeeded, no error/warn logs |
| Municipality | Weighted statistics and filter update | Wellesley 11,318 residents, 19 DAs, 11 priority, 0% coverage; Reset restored region | Pass | None |
| Tabs/comparison | Three tabs; metric changes rankings | Overview/Layers/Compare switched; 400 m metric displayed Cambridge 83.8%, Kitchener 82.9%, Waterloo 81.0% | Pass | None |
| Layer controls/legend | Visibility, opacity and legend follow controls | Five network layers enabled; legend group appeared; opacity changed to 61%/26%; reset restored defaults | Pass | Stops require zoom 11+ as labelled |
| Basemaps | Preserve analytical data | Standard, Dark and reset to Light accepted; streets rendered | Pass | Dark intentionally has no street data |
| Stop/DA search | Keyboard selection, highlight and details | 4236: 28 departures, 2.33/hour, Moderate; DA35300040: 1,099 population, 99.5% within 800 m | Pass | None |
| Route/no-result search | Combined existing shapes / explicit empty state | Documented actual Phase 5 browser checks; automated real-data search tests passed again | Pass (prior browser + current unit) | Not independently repeated in final browser session |
| Comparison CSV | Download real data | Download event returned transitscope-municipalities (1).csv | Pass | Phase 5 saved sample plus escaping tests provide content evidence |
| Selected CSV and PNG | Export with metadata/attribution | Actual saved Phase 5 artifacts inspected; current PNG loading/timeout/CORS/late-encoding regressions passed | Pass (prior browser + current unit) | Fresh PNG browser export still to repeat |
| Zoom/pan/reset/fullscreen | Map camera and fallback usable | Prior Phase 5 browser evidence documents these controls | Pass (prior browser) | Final-session camera/fullscreen retest pending |
| Methodology/Sources/About | Dialog opens, closes and explains dates | All three opened on mobile; explicit scheduled service and straight-line limits present | Pass | None |
| Responsive layouts | Accessible map and panels | Actual screenshots at five requested sizes inspected; tablet drawer collapses; mobile detail panel scrolls | Pass | Screenshots inline, not standalone files; mobile document width 390 equals viewport |
| Keyboard/focus/semantics | Labels, keyboard tabs/search, visible focus | ArrowDown/Enter search worked; slider keyboard change visible; native dialog close received focus | Pass (targeted) | Screen-reader and exhaustive contrast audit not tested |
| Failure handling | Data/basemap failure does not hang analytics | Regression verifies style-ready independent load; code isolates source failure and unavailable state | Pass (unit/code) | Live network fault injection not tested |
| Spatial data | Source attributes, geometry, totals, classes agree | All nine files pass release validation, independent GTFS count check | Pass | Explicit precision tolerances; historical archive still missing |
| Tests/build | Reproducible syntax and bundle | 24 JS, 14 Python tests passed; syntax/build successful | Pass | No separate lint/typecheck configured for vanilla JS |
| Public URL | Assets/data/controls load below repository subpath | Not yet deployed | Not tested | Complete authenticated deployment and verify |

## Reliability fixes

Analytics now starts on style.load rather than waiting for external tile completion. Historical data becomes usable without waiting for GTFS. Late network completion reapplies the selected municipality and highlight order. Missing historical data gives an explicit unavailable state. PNG export rejects an incomplete map, times out after 15 seconds, restores controls and ignores late encoding callbacks.

## Measured performance and limits

Production build measured main JS 1,103.32 kB / 308.41 kB gzip; CSS 89.14 kB / 14.31 kB gzip; worker 547.46 kB; HTML 13.79 kB / 4.78 kB gzip. Vite's >500 kB chunk warning remains, primarily the mapping runtime. No fabricated Lighthouse score, memory/FPS or cold-load benchmark is supplied. Search normalizes local data once; comparison aggregates once; filters and basemap changes reuse sources. Geometry was not simplified to improve a synthetic score.

## Remaining manual academic work

Student-authored reflection, personal documentation reading, report-ready screenshot capture, screen-reader testing and any course-specific assessment remain personal activities. Public deployment evidence will be recorded below when observed.
