# Assets

The game is playable with placeholder parts. For ready-to-paste Studio `/generate` prompts for every model, see [MODEL_PROMPTS.md](MODEL_PROMPTS.md). Models are scaled and placed automatically. Each visual looks for a model with the exact name below in `ReplicatedStorage.Assets` and falls back to a placeholder when it is missing. Models should be anchored, low-poly, and use `PrimaryPart` set to the base so `PivotTo` places them correctly.

Budget for mobile: keep each enemy under 2,000 triangles, structures under 5,000, and the harbor under 60,000 in view. Use `Enabled = false` on decorative lights at night on low graphics quality.

## World

| Name | Used by | Notes |
| --- | --- | --- |
| Harbor_Ground | WorldBuilder | Sand and grass town base, about 300 x 200 studs |
| Harbor_Sea | WorldBuilder | Water plane or terrain hint, non-colliding |
| Harbor_Pier | WorldBuilder | Fishing pier |
| Harbor_MarketStall | WorldBuilder | Market |
| Harbor_FarmPatch | WorldBuilder | 6 to 18 plot farm area |
| Forage_driftwood / Forage_shells / Forage_ironScrap | WorldBuilder | Shoreline node props (ProximityPrompt is added by code) |
| Sector_Ground / Sector_Sea | WorldBuilder | Night sector beach and sea, 72 x 90 studs |
| Structure_lighthouse / Structure_seawall / Structure_dock | WorldBuilder, NightClient | Each needs 3 visible damage looks; the client tints the placeholder today. Ship as child models named Stage0, Stage1, Stage2, Stage3 |
| Building_<id>_T1 to Building_<id>_T5 | WorldBuilder.applyHarborTiers | 25 models, one per tier, for lighthouse, market, docks, seawall, workshop |

## Characters and enemies

| Name | Notes |
| --- | --- |
| Enemy_crawler | Small, fast; idle and walk animation |
| Enemy_brute | Large, slow; attack animation |
| Enemy_spitter | Ranged; spit projectile VFX |
| Boss_TheUndertow | Water giant; 3 phase looks, shield FX, weak point sockets |

## Drifters (20 models plus a hatch egg)

| Model name | Element | Rarity |
| --- | --- | --- |
| Drifter_puddlefin | tide | common |
| Drifter_ripplet | tide | uncommon |
| Drifter_brinehop | tide | rare |
| Drifter_surgeling | tide | epic |
| Drifter_maelstrom_koi | tide | legendary |
| Drifter_cindermite | ember | common |
| Drifter_ashpaw | ember | uncommon |
| Drifter_flickerfin | ember | rare |
| Drifter_magmaw | ember | epic |
| Drifter_phoenix_eel | ember | legendary |
| Drifter_sprouty | moss | common |
| Drifter_lichenpup | moss | uncommon |
| Drifter_bramblesnail | moss | rare |
| Drifter_mossback | moss | epic |
| Drifter_elder_kelpwyrm | moss | legendary |
| Drifter_chillbub | frost | common |
| Drifter_rimecrab | frost | uncommon |
| Drifter_glacipede | frost | rare |
| Drifter_frostfang | frost | epic |
| Drifter_aurora_ray | frost | legendary |
| Egg_Standard | - | hatch reveal |

## Cosmetics

**Drifter skins** (16): `skin_aurora_cloak`, `skin_bandana`, `skin_bubble_helm`, `skin_club_beret`, `skin_club_scarf`, `skin_crown_of_shells`, `skin_leviathan_costume`, `skin_pass_admiral`, `skin_pass_captain`, `skin_pass_explorer`, `skin_pass_lifejacket`, `skin_pirate_hat`, `skin_raincoat`, `skin_sailor_cap`, `skin_starter_sailor`, `skin_tidecaller_robe`

**Harbor decorations** (16): `deco_anchor_statue`, `deco_buoy`, `deco_club_banner`, `deco_club_bench`, `deco_coral_gazebo`, `deco_golden_topper`, `deco_kelp_arch`, `deco_lantern_post`, `deco_lantern_string`, `deco_lighthouse_mural`, `deco_net_pile`, `deco_pass_bell`, `deco_pass_flagpole`, `deco_pass_ship_in_bottle`, `deco_pearl_arch`, `deco_shell_fountain`

**Rod skins** (8): `rodskin_bamboo`, `rodskin_club_silver`, `rodskin_coral`, `rodskin_glow`, `rodskin_painted`, `rodskin_pass_brass`, `rodskin_starlight`, `rodskin_starter_lantern`

**Emotes** (6): `emote_cheer`, `emote_club_bow`, `emote_dance`, `emote_salute`, `emote_splash`, `emote_wave`

Drifter skins attach to every Drifter model through an accessory socket named `SkinSocket`. Rod skins replace the rod mesh. Decorations are placed props in the player's harbor area. Emotes are animations plus an icon.

## Fishing

| Name | Notes |
| --- | --- |
| Rod_tier1 to Rod_tier4 | Driftwood, Reed, Bronze, Tidesteel |
| Fish icons (20 + Golden Harbor Snapper) | 128 x 128 icons named Icon_<fishId> |
| Crop icons (4) | Icon_<cropId>; 3 growth stage props per crop |

## UI

| Name | Notes |
| --- | --- |
| Icon_Silver, Icon_Pearl, Icon_Gem | Currency icons (the HUD uses text glyphs today) |
| Rarity shape icons | circle, square, triangle, diamond, star (text glyphs today) |
| Shop art | One card image per product |
| Season banners (6) | One per season id |

## Audio

| Name | Notes |
| --- | --- |
| Music_Day, Music_Dusk, Music_Night, Music_Boss | Loops; volume follows the Music setting |
| SFX_Cast, SFX_Bite, SFX_Catch, SFX_Miss | Fishing |
| SFX_Plant, SFX_Harvest, SFX_Forage, SFX_Sell | Day loop |
| SFX_Hatch, SFX_RareHatch | Hatching |
| SFX_Hit, SFX_Charge, SFX_Ability_<element> | Combat |
| SFX_Repair, SFX_StructureStage, SFX_Telegraph, SFX_WeakPoint, SFX_BossStun | Night |
| SFX_UI_Tap, SFX_Purchase | UI |

## Animations

Cast, reel, idle-fishing, plant, harvest, gather, sell, hit, charge-hold, charge-release, ability (one per element), repair, stunned, hatch reveal, and one animation per emote.

## VFX

Telegraph ring (pulsing; static when Reduce Motion is on), weak point glow, shield, boss stun, hatch sparkle per rarity, structure damage dust, repair sparks.
