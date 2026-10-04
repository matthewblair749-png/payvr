# 3D model prompts

Tidebound draws every model with code, so the game works with no art at all. To swap in better models, make them in Roblox Studio and give them the names below. The game finds them by name, scales them to the right height, stands them on the ground and anchors them. You do not need to size or place anything by hand.

## How to make one model

1. In Studio, open the **Assistant** (View → Assistant).
2. Type `/generate` and paste one prompt from the tables below. Wait for the model to appear in Workspace.
3. If you don't like it, run the prompt again. Small changes to the wording give different results.
4. Rename the model to the exact **Name** in the table. Names are case-sensitive.
5. In Explorer, find **ReplicatedStorage**. If it has no folder named `Assets`, add one (right-click → Insert Object → Folder, name it `Assets`).
6. Drag the model into `ReplicatedStorage.Assets`.
7. Press Play to check it, then File → Publish to Roblox.

You can also use models from the Toolbox (Creator Store) or from Blender. The rules are the same: rename, then put the model in `ReplicatedStorage.Assets`.

## Keep your models when you rebuild the place

Building a new place file from this repo replaces everything in Studio, including `ReplicatedStorage.Assets`. To keep your art:

1. Put all your models in one folder named `Assets`.
2. Right-click the folder → **Convert to Package**, then publish it.
3. Copy the package's asset ID (right-click → Copy Asset ID).
4. Set `"assetPackageId"` in `shared/config/harbor.json` to that number and rebuild.

The server loads the package when it starts. Models placed straight into `ReplicatedStorage.Assets` still work and take priority over the package.

## Style line

Every prompt below ends with the same style line so the models match each other and the UI:

> stylized cozy low-poly, soft rounded shapes, bright saturated colors, hand-painted look, game asset, single object, no ground

## Drifters

The game scales Drifters to about 3 studs tall (legendary ones to about 4). Prompts describe a small round creature, which matches how they are drawn now.

| Name | Prompt |
| --- | --- |
| Drifter_puddlefin | small round blue fish creature with big shiny eyes, stubby fins, water droplet on its head, cute, stylized cozy low-poly, soft rounded shapes, bright saturated colors, hand-painted look, game asset, single object, no ground |
| Drifter_ripplet | small teal blob creature made of rippling water rings, big eyes, tiny wave crest on top, cute, stylized cozy low-poly, soft rounded shapes, bright saturated colors, hand-painted look, game asset, single object, no ground |
| Drifter_brinehop | round sea frog with salt-white spots and long back legs, blue and white, big eyes, cute, stylized cozy low-poly, soft rounded shapes, bright saturated colors, hand-painted look, game asset, single object, no ground |
| Drifter_surgeling | chubby wave spirit with a curling wave for a tail and glowing blue eyes, foam around its body, stylized cozy low-poly, soft rounded shapes, bright saturated colors, hand-painted look, game asset, single object, no ground |
| Drifter_maelstrom_koi | majestic koi fish with flowing fins circling a small whirlpool, deep blue and gold, glowing, stylized cozy low-poly, soft rounded shapes, bright saturated colors, hand-painted look, game asset, single object, no ground |
| Drifter_cindermite | tiny round ember beetle with a glowing orange back and soot black legs, cute, stylized cozy low-poly, soft rounded shapes, bright saturated colors, hand-painted look, game asset, single object, no ground |
| Drifter_ashpaw | small fox cub with grey ash fur and glowing ember paws, big eyes, stylized cozy low-poly, soft rounded shapes, bright saturated colors, hand-painted look, game asset, single object, no ground |
| Drifter_flickerfin | small fish made of candle flame, orange and yellow fins, big eyes, stylized cozy low-poly, soft rounded shapes, bright saturated colors, hand-painted look, game asset, single object, no ground |
| Drifter_magmaw | chubby lava toad with cracked black rock skin and glowing orange cracks, wide mouth, stylized cozy low-poly, soft rounded shapes, bright saturated colors, hand-painted look, game asset, single object, no ground |
| Drifter_phoenix_eel | long eel with fiery wing fins and a flame crest, red, orange and gold, glowing, stylized cozy low-poly, soft rounded shapes, bright saturated colors, hand-painted look, game asset, single object, no ground |
| Drifter_sprouty | small round green seed creature with a leaf sprout on its head, big eyes, cute, stylized cozy low-poly, soft rounded shapes, bright saturated colors, hand-painted look, game asset, single object, no ground |
| Drifter_lichenpup | puppy covered in soft moss and lichen patches, green and cream, big eyes, stylized cozy low-poly, soft rounded shapes, bright saturated colors, hand-painted look, game asset, single object, no ground |
| Drifter_bramblesnail | snail with a shell made of twisted brambles and tiny flowers, green and brown, stylized cozy low-poly, soft rounded shapes, bright saturated colors, hand-painted look, game asset, single object, no ground |
| Drifter_mossback | chubby turtle with a mossy hill on its shell, small mushrooms and grass, stylized cozy low-poly, soft rounded shapes, bright saturated colors, hand-painted look, game asset, single object, no ground |
| Drifter_elder_kelpwyrm | long sea dragon made of kelp with leafy whiskers and glowing green eyes, stylized cozy low-poly, soft rounded shapes, bright saturated colors, hand-painted look, game asset, single object, no ground |
| Drifter_chillbub | small round ice bubble creature with frosty blue skin and big eyes, cute, stylized cozy low-poly, soft rounded shapes, bright saturated colors, hand-painted look, game asset, single object, no ground |
| Drifter_rimecrab | small crab with ice crystal claws and a frosty white shell, stylized cozy low-poly, soft rounded shapes, bright saturated colors, hand-painted look, game asset, single object, no ground |
| Drifter_glacipede | chubby centipede made of ice segments, light blue, many tiny legs, big eyes, stylized cozy low-poly, soft rounded shapes, bright saturated colors, hand-painted look, game asset, single object, no ground |
| Drifter_frostfang | small snow wolf cub with icy fangs and a crystal mane, white and pale blue, stylized cozy low-poly, soft rounded shapes, bright saturated colors, hand-painted look, game asset, single object, no ground |
| Drifter_aurora_ray | manta ray with aurora-colored wings, green, purple and blue gradient, glowing, stylized cozy low-poly, soft rounded shapes, bright saturated colors, hand-painted look, game asset, single object, no ground |

Replace "stylized cozy low-poly, soft rounded shapes, bright saturated colors, hand-painted look, game asset, single object, no ground" with the style line above when you paste.

## Night enemies and boss

| Name | Height | Prompt |
| --- | --- | --- |
| Enemy_crawler | 2 | small dark purple sea crab monster with glowing teal eyes and sharp claws, slimy, stylized cozy low-poly, soft rounded shapes, bright saturated colors, hand-painted look, game asset, single object, no ground |
| Enemy_brute | 5.5 | big hulking sea monster made of barnacled rock and coral, glowing teal cracks, heavy fists, stylized cozy low-poly, soft rounded shapes, bright saturated colors, hand-painted look, game asset, single object, no ground |
| Enemy_spitter | 3 | round pufferfish monster with spikes and a wide glowing mouth, dark purple and teal, stylized cozy low-poly, soft rounded shapes, bright saturated colors, hand-painted look, game asset, single object, no ground |
| Boss_TheUndertow | about 20 | giant water titan rising from the sea, body of dark swirling water, glowing teal core in its chest, crown of coral, huge arms, stylized cozy low-poly, soft rounded shapes, bright saturated colors, hand-painted look, game asset, single object, no ground |

## Harbor and world

| Name | Height | Prompt |
| --- | --- | --- |
| Landmark_Lighthouse | 52 | tall lighthouse with red and white stripes, glowing lamp room, stone base, small balcony, stylized cozy low-poly, soft rounded shapes, bright saturated colors, hand-painted look, game asset, single object, no ground |
| Harbor_MarketStall | 11 | wooden market stall with a red and white striped awning, crates of fish and fruit, hanging lantern, stylized cozy low-poly, soft rounded shapes, bright saturated colors, hand-painted look, game asset, single object, no ground |
| PalmTree | 17 | tropical palm tree with a curved trunk and big green leaves, coconuts, stylized cozy low-poly, soft rounded shapes, bright saturated colors, hand-painted look, game asset, single object, no ground |
| Lantern | 8 | wooden post with a warm glowing paper lantern hanging from a hook, stylized cozy low-poly, soft rounded shapes, bright saturated colors, hand-painted look, game asset, single object, no ground |
| Forage_driftwood | 2.5 | pile of pale weathered driftwood logs, stylized cozy low-poly, soft rounded shapes, bright saturated colors, hand-painted look, game asset, single object, no ground |
| Forage_shells | 1.5 | small pile of colorful seashells and a pink conch, stylized cozy low-poly, soft rounded shapes, bright saturated colors, hand-painted look, game asset, single object, no ground |
| Forage_ironScrap | 2 | small pile of rusty iron scrap, gears and an old anchor chain, stylized cozy low-poly, soft rounded shapes, bright saturated colors, hand-painted look, game asset, single object, no ground |
| Structure_lighthouse | 28 | sturdy short lighthouse tower with a glowing lamp, stone base, red and white stripes, stylized cozy low-poly, soft rounded shapes, bright saturated colors, hand-painted look, game asset, single object, no ground |

## Harbor buildings

Each building can have one model per tier (`Building_market_T1` to `Building_market_T5`) or one model for all tiers (`Building_market`). With one model the game makes it a little bigger each tier. Height: 20 studs at tier 1, plus 4 per tier.

| Name | Prompt |
| --- | --- |
| Building_lighthouse | small seaside keeper's cottage with a round tower and a glowing lamp, white walls, blue roof, stylized cozy low-poly, soft rounded shapes, bright saturated colors, hand-painted look, game asset, single object, no ground |
| Building_market | cozy two-story market hall with a striped awning, wooden signs, crates outside, stylized cozy low-poly, soft rounded shapes, bright saturated colors, hand-painted look, game asset, single object, no ground |
| Building_docks | wooden boathouse on stilts with a rope pulley and a small rowboat, stylized cozy low-poly, soft rounded shapes, bright saturated colors, hand-painted look, game asset, single object, no ground |
| Building_seawall | stone guard tower with battlements and a blue banner, stylized cozy low-poly, soft rounded shapes, bright saturated colors, hand-painted look, game asset, single object, no ground |
| Building_workshop | wooden workshop with a big chimney, anvil and tools outside, warm windows, stylized cozy low-poly, soft rounded shapes, bright saturated colors, hand-painted look, game asset, single object, no ground |

## Tips

- Generate the Drifters first. They show up in the most places: the hatch reveal, the collection, the detail card and as followers.
- Generated models can be heavy. If the game slows on phones, pick the simpler result or run the prompt again with "very low-poly" added.
- If a model shows up sideways, rotate it in Studio before you drag it into `Assets`. The game keeps its rotation and only changes its size and position.
