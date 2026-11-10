# Použité volné podklady

Vše z [Poly Haven](https://polyhaven.com), licence **CC0 1.0** (volné dílo, bez povinnosti uvádět autora). Staženo 2026-11-10.

## HDRI (osvětlení a pozadí), rozlišení 1k, formát `.hdr`
| Soubor | Asset | K čemu |
|---|---|---|
| `hdri/studio_small_08_1k.hdr` | https://polyhaven.com/a/studio_small_08 | prostředí „Studio“ |
| `hdri/brown_photostudio_02_1k.hdr` | https://polyhaven.com/a/brown_photostudio_02 | „Teplé studio“ |
| `hdri/rooitou_park_1k.hdr` | https://polyhaven.com/a/rooitou_park | „Zahrada“ |
| `hdri/kloofendal_48d_partly_cloudy_puresky_1k.hdr` | https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky | „Venku – obloha“ |

Slunce se v datech HDRI při načtení ořízne (svítí místo něj směrové světlo se stínem). Soubory jsou beze změny.

## Textury (barva, normála, AO/drsnost/kov), 1k JPG
| Soubory `tex/…` | Asset | K čemu |
|---|---|---|
| `oak_veneer_01_*` | https://polyhaven.com/a/oak_veneer_01 | dub, jasan (zesvětlený), madlo |
| `wood_table_001_*` | https://polyhaven.com/a/wood_table_001 | tmavé dřevo |
| `wood_floor_deck_*` | https://polyhaven.com/a/wood_floor_deck | podlaha terasy |
| `concrete_floor_worn_001_*` | https://polyhaven.com/a/concrete_floor_worn_001 | beton (deska, podlaha) |
| `plastered_wall_04_*` | https://polyhaven.com/a/plastered_wall_04 | omítka fasády |

Úpravy: JPG znovu uložené s kvalitou 80–86 (menší soubory); u `concrete_floor_worn_001_Diffuse` a `plastered_wall_04_Diffuse` zvýšený jas (×1,8 a ×1,32).

## Počítané v prohlížeči (nic se nestahuje)
Pomerančová kůra práškového laku, květ zinku, rýhy surové oceli, housenka svaru, rýhování hrany po laseru: `render/materialy.js`.

## Knihovny (z CDN, pevná verze)
- three.js 0.187.0 (MIT) – https://cdn.jsdelivr.net/npm/three@0.187.0/
- `<model-viewer>` 4.1.0 (Apache-2.0), načítá se jen po kliknutí na „V místnosti“
