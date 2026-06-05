# Bullet Dodge

## Game overview
**Title:** Bullet Dodge  
**Genre:** Survival / Arcade  
**Core mechanic:** Player pilots a fighter jet and must dodge an endless rain of bullets fired from all 4 sides of the screen. No enemies — just survive as long as possible. Bullets gradually get faster and more frequent over time.

## Features implemented
- Fighter jet drawn entirely with Phaser Graphics (clean & modern style, cyan/blue palette)
- Bullets from all 4 sides (top = yellow, bottom = magenta, left = red, right = teal-green)
- Each bullet is a glowing elongated ellipse oriented to its travel direction
- 3 lives with hit invincibility frames (player blinks, screen red-flashes, camera shakes)
- Survival timer in top-center, color shifts white → orange → red as intensity grows
- Lives display (♥ icons) in top-right
- Difficulty escalation every 5 seconds: spawn delay decreases (800 ms → 160 ms min), bullet speed increases (300 → 720 max)
- Jet banking tilt on horizontal movement (subtle rotation)
- Twin-engine exhaust particle trail follows the plane
- Explosion particle burst on death
- Game-over panel with final time, best time, click/space to retry
- Best time persisted via `umicat.saves` (key: `highScore`)
- Sky-blue gradient background with subtle cloud silhouettes and flight-path grid

## Key implementation details
- **GameScene.ts** — all game logic, drawing, HUD, physics, game-over overlay
- **UIScene.ts** — stub (HUD handled inside GameScene)
- **main.ts** — exports `umicatReady` (Umicat.init) for saves access
- Player uses `physics.add.image` with `setCollideWorldBounds(true)`; hitbox `setSize(20, 34)` + `setOffset(22, 23)`
- Bullets use `group.create(x, y, key)` then velocity set — avoids body reset quirk
- Textures generated once via `this.make.graphics({ add: false })` + `generateTexture`, guarded by `this.textures.exists(key)` so restarts don't re-generate
- `scene.restart()` reuses same instance; `bestTime` / `bestTimeLoaded` persist, game-state vars reset in `create()`

## Controls
- **WASD** or **Arrow Keys** to move

## Last change
Initial build — complete game from scratch.
