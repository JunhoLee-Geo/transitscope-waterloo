# Licensing and attribution

This notice separates project software from data and third-party code. The project is published at the request of the owner of the original analysis and the authenticated JunhoLee-Geo account. That authorization does not remove underlying dataset licence conditions.

## Project material

Copyright 2026 Junho Lee. No blanket open-source licence is applied to this repository in this release. Source is available for inspection; seek the author's permission for reuse beyond rights provided by law. Third-party data rights below remain available independently. A future software-only licence can be added by the author without changing third-party dataset terms. This preserves a deliberate author choice rather than inventing permission for unrelated materials.

## Statistical data and derived historical estimates

Adapted from Statistics Canada, 2021 Census. This does not constitute an endorsement by Statistics Canada of this product.

Underlying Census information remains subject to the [Statistics Canada Open Licence](https://www.statcan.gc.ca/en/terms-conditions/open-licence). The licence permits redistribution and value-added products subject to accuracy, acknowledgement and non-endorsement conditions. Historical estimates derive from [Junho Lee's original analysis](https://github.com/JunhoLee-Geo/Waterloo-transit-accessibility), inspected at commit966a88ccde44994fa2e60060c2b7c332228528ed. No licence file was found in that original snapshot; publication here is authorized by its owner, not inferred merely from public availability.

## Region of Waterloo data

Contains information provided by the Regional Municipality of Waterloo under licence.

GTFS, municipal outlines and derived transit geometry are governed by the [Region of Waterloo Open Data Licence](https://regionofwaterloo-018-ca.govstack.com/government-and-council/transparency-and-accountability/open-data/). The official page permits copying, publishing and adapting information, with non-endorsement and source-accuracy conditions and exceptions for rights the Region cannot license. Its heading saysv2.0 while a later paragraph saysv1.0; retain the source link rather than resolving that inconsistency by assumption. The [GRT open-data page](https://www.grt.ca/about-grt/open-data/) links schedule data to this licence. This application is not endorsed by GRT or the Region. Municipal boundaries are contextual and not definitive legal boundaries.

Raw GTFS ZIPs and local Python environments are excluded from Git. Download and regeneration instructions are in scripts/GTFS.md. A later download may differ from the archived snapshot; checksums identify the exact original inputs. Processed published GeoJSON is retained for a functional static application.

## Basemap and software dependencies

Street tiles: © OpenStreetMap contributors. [Copyright/ODbL](https://www.openstreetmap.org/copyright) and [tile usage policy](https://operations.osmfoundation.org/policies/tiles/) apply. Attribution stays visible; no offline/bulk tile acquisition is provided. Dark analysis mode does not request an alternative dark tile service. Tile availability is not guaranteed.

MapLibre GL JS and Vite retain their respective BSD-3-Clause and MIT licences and bundled dependency notices; see the installed package licence files and upstream repositories. Their licences do not license datasets. No CARTO tiles are requested in this release.

Reviewed against official pages on25November2026. This records release provenance and conditions, not legal advice or a waiver of third-party rights.
