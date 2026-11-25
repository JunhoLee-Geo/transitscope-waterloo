# Phase 4 design decisions

## Visual system
Navy #142B3D anchors identity and text; teal #087F8C signals selection and comparison; application #F5F7FA, panels #FFFFFF and borders #E2E8F0 separate regions without decorative effects. Priority outlines use #D94801. Historical blue accessibility and GTFS frequency colours retain their established meanings. Inter falls back to Segoe UI/Arial without adding a remote font dependency. Spacing uses a 4/8px basis, restrained shadows and small corner radii.

## Hierarchy and interaction
A compact persistent header provides functional Explore Map, Methodology, Data Sources and About navigation. The original repository link identifies the analysis source. The map remains the main work surface; a 330px independently scrolling sidebar carries statistics and layer controls. Tablet/mobile uses a collapsible overlay so the map need not wait below a long document. ResizeObserver resizes MapLibre when available map dimensions change.

KPI cards aggregate the actual historical DA attributes. Exclusive distance bands subtract within400 from within800 and within800 from total. Municipal rates divide covered population sums by population sums. Missing data does not become a plausible zero. Municipality selection filters historical layers and current stops; uncut routes and buffers remain labelled regional context. The current municipal outline highlights selection and supports zooming, while historical counts follow original DA membership.

A floating scrollable/collapsible legend separates historical and new GTFS dates. Feature details use a contextual panel rather than an oversized map-anchored popup. Semantic buttons, checkboxes, select, details and native dialog supply keyboard semantics; focus is visible and reduced motion is respected. Colour is supplemented by labels, percentages and counts. The map itself remains a canvas: a complete screen-reader spatial equivalent is not claimed.

## Boundaries
No framework or dependencies were added. Data processing, original source repository and generated geographic datasets remain unchanged. No live transit, walking-network coverage, new population-access recomputation or public deployment is implied.
