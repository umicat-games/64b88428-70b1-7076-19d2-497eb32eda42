import Phaser from 'phaser';
import { loadWorldScene } from '@umicat/phaser-sdk';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

type BulletSide = 'top' | 'bottom' | 'left' | 'right';

export class GameScene extends Phaser.Scene {
  // Game objects
  private player!: Phaser.Physics.Arcade.Image;
  private exhaustEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private bullets!: Phaser.Physics.Arcade.Group;

  // Input
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    up:    Phaser.Input.Keyboard.Key;
    down:  Phaser.Input.Keyboard.Key;
    left:  Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };

  // Game state
  private survivalTime = 0;
  private alive = true;
  private lives = 3;
  private invincible = false;

  // Difficulty
  private spawnDelay  = 800;
  private bulletSpeed = 300;
  private readonly MIN_SPAWN_DELAY  = 160;
  private readonly MAX_BULLET_SPEED = 720;
  private readonly PLAYER_SPEED     = 320;

  // Timers
  private spawnTimer!: Phaser.Time.TimerEvent;

  // HUD
  private timerText!:    Phaser.GameObjects.Text;
  private livesDisplay!: Phaser.GameObjects.Text;

  // Persisted across restarts (same instance)
  private bestTime       = 0;
  private bestTimeLoaded = false;

  constructor() {
    super({ key: 'GameScene' });
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  async create(): Promise<void> {
    // Reset per-run state
    this.survivalTime = 0;
    this.alive        = true;
    this.lives        = 3;
    this.invincible   = false;
    this.spawnDelay   = 800;
    this.bulletSpeed  = 300;

    await loadWorldScene(this, 'main');

    this.drawBackground();
    this.createTextures();
    this.setupPlayer();
    this.setupInput();
    this.setupBullets();
    this.setupHUD();
    this.startSpawning();
    this.setupDifficultyEscalation();

    if (!this.bestTimeLoaded) {
      this.bestTimeLoaded = true;
      this.loadBestTime();
    }
  }

  // ─── Background ────────────────────────────────────────────────────────────

  private drawBackground(): void {
    const bg = this.add.graphics().setDepth(0);

    // Sky gradient: deep navy top → medium blue bottom
    bg.fillGradientStyle(0x0d2353, 0x0d2353, 0x1565c0, 0x1565c0, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Subtle horizon glow
    bg.fillGradientStyle(0x1e88e5, 0x1e88e5, 0x1565c0, 0x1565c0, 0.18);
    bg.fillRect(0, GAME_HEIGHT * 0.42, GAME_WIDTH, GAME_HEIGHT * 0.58);

    // Static cloud silhouettes
    bg.fillStyle(0xffffff, 0.055);
    const clouds = [
      { x: 110,  y: 88,  w: 220, h: 55 },
      { x: 440,  y: 150, w: 300, h: 48 },
      { x: 880,  y: 70,  w: 240, h: 58 },
      { x: 1140, y: 265, w: 200, h: 44 },
      { x: 255,  y: 375, w: 260, h: 52 },
      { x: 730,  y: 565, w: 210, h: 46 },
      { x: 45,   y: 495, w: 170, h: 40 },
      { x: 1065, y: 485, w: 195, h: 44 },
    ];
    clouds.forEach(c => bg.fillEllipse(c.x, c.y, c.w, c.h));

    // Flight-path grid overlay
    bg.lineStyle(1, 0xffffff, 0.04);
    for (let x = 0; x <= GAME_WIDTH; x += 80) bg.lineBetween(x, 0, x, GAME_HEIGHT);
    for (let y = 0; y <= GAME_HEIGHT; y += 80) bg.lineBetween(0, y, GAME_WIDTH, y);
  }

  // ─── Texture creation ──────────────────────────────────────────────────────

  private createTextures(): void {
    this.createPlaneTexture();
    this.createBulletTextures();
    this.createParticleTexture();
  }

  private createPlaneTexture(): void {
    if (this.textures.exists('plane')) return;

    const g = this.make.graphics({ x: 0, y: 0, add: false });
    const cx = 32, cy = 40; // 64 × 80 canvas

    // Soft drop-shadow
    g.fillStyle(0x000022, 0.22);
    g.fillEllipse(cx + 2, cy + 3, 24, 62);

    // Wing shadows
    g.fillStyle(0x003d6b, 0.55);
    g.fillTriangle(cx - 4, cy + 4, cx - 31, cy + 23, cx - 2, cy + 19);
    g.fillTriangle(cx + 4, cy + 4, cx + 31, cy + 23, cx + 2, cy + 19);

    // Main wings
    g.fillStyle(0x0277bd);
    g.fillTriangle(cx - 3, cy + 2, cx - 29, cy + 18, cx - 1, cy + 14);
    g.fillTriangle(cx + 3, cy + 2, cx + 29, cy + 18, cx + 1, cy + 14);

    // Wing top highlight
    g.fillStyle(0x4fc3f7, 0.55);
    g.fillTriangle(cx - 3, cy + 2, cx - 17, cy + 11, cx - 1, cy + 8);
    g.fillTriangle(cx + 3, cy + 2, cx + 17, cy + 11, cx + 1, cy + 8);

    // Tail fins
    g.fillStyle(0x01579b);
    g.fillTriangle(cx - 4, cy + 20, cx - 14, cy + 34, cx - 2, cy + 28);
    g.fillTriangle(cx + 4, cy + 20, cx + 14, cy + 34, cx + 2, cy + 28);

    // Engine nacelles (twin engines)
    g.fillStyle(0x0288d1);
    g.fillEllipse(cx - 8, cy + 5, 8, 24);
    g.fillEllipse(cx + 8, cy + 5, 8, 24);

    // Nacelle shadow
    g.fillStyle(0x01579b, 0.5);
    g.fillEllipse(cx - 8, cy + 5, 4, 22);
    g.fillEllipse(cx + 8, cy + 5, 4, 22);

    // Main fuselage
    g.fillStyle(0x00b4d8);
    g.fillEllipse(cx, cy, 18, 58);

    // Fuselage sheen
    g.fillStyle(0xb3e5fc, 0.28);
    g.fillEllipse(cx - 3, cy - 4, 5, 36);

    // Nose cone
    g.fillStyle(0xe1f5fe);
    g.fillTriangle(cx, cy - 35, cx - 9, cy - 20, cx + 9, cy - 20);

    // Nose specular
    g.fillStyle(0xffffff, 0.7);
    g.fillTriangle(cx, cy - 35, cx - 2, cy - 27, cx + 2, cy - 27);

    // Cockpit canopy
    g.fillStyle(0x01579b, 0.92);
    g.fillEllipse(cx, cy - 7, 11, 16);

    // Canopy glint
    g.fillStyle(0x80d8ff, 0.8);
    g.fillEllipse(cx - 1.5, cy - 11, 3.5, 5);

    // Engine exhausts
    g.fillStyle(0xff6d00, 0.65);
    g.fillEllipse(cx - 8, cy + 17, 5, 9);
    g.fillEllipse(cx + 8, cy + 17, 5, 9);
    g.fillStyle(0xffab00, 0.85);
    g.fillEllipse(cx - 8, cy + 18, 3, 6);
    g.fillEllipse(cx + 8, cy + 18, 3, 6);

    g.generateTexture('plane', 64, 80);
    g.destroy();
  }

  private createBulletTextures(): void {
    const configs: Array<{ side: BulletSide; color: number; w: number; h: number }> = [
      { side: 'top',    color: 0xffdd00, w: 10, h: 28 },
      { side: 'bottom', color: 0xff44dd, w: 10, h: 28 },
      { side: 'left',   color: 0xff4455, w: 28, h: 10 },
      { side: 'right',  color: 0x44ffaa, w: 28, h: 10 },
    ];

    configs.forEach(({ side, color, w, h }) => {
      const key = `bullet_${side}`;
      if (this.textures.exists(key)) return;

      const g = this.make.graphics({ x: 0, y: 0, add: false });
      const cx = w / 2, cy = h / 2;
      const r = Math.min(w, h) * 0.1;

      // Outer glow
      g.fillStyle(color, 0.18);
      g.fillEllipse(cx, cy, w, h);
      // Mid glow
      g.fillStyle(color, 0.5);
      g.fillEllipse(cx, cy, w * 0.68, h * 0.68);
      // Core
      g.fillStyle(color, 1);
      g.fillEllipse(cx, cy, w * 0.46, h * 0.46);
      // Bright center
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(cx, cy, r);

      g.generateTexture(key, w, h);
      g.destroy();
    });
  }

  private createParticleTexture(): void {
    if (this.textures.exists('exhaust_p')) return;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xff6d00, 1);
    g.fillCircle(5, 5, 5);
    g.fillStyle(0xffcc00, 0.75);
    g.fillCircle(5, 5, 3);
    g.fillStyle(0xffffff, 0.55);
    g.fillCircle(5, 5, 1.5);
    g.generateTexture('exhaust_p', 10, 10);
    g.destroy();
  }

  // ─── Player ────────────────────────────────────────────────────────────────

  private setupPlayer(): void {
    this.player = this.physics.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'plane');
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(20, 34);
    body.setOffset(22, 23);

    // Exhaust particles (follow updated in update())
    this.exhaustEmitter = this.add.particles(
      this.player.x, this.player.y, 'exhaust_p',
      {
        speed:    { min: 25, max: 75 },
        angle:    { min: 75, max: 105 },
        scale:    { start: 0.9, end: 0 },
        alpha:    { start: 0.85, end: 0 },
        lifespan: 260,
        frequency: 32,
        quantity:  1,
      }
    );
    this.exhaustEmitter.setDepth(9);
  }

  // ─── Input ─────────────────────────────────────────────────────────────────

  private setupInput(): void {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      up:    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
  }

  // ─── Bullets ───────────────────────────────────────────────────────────────

  private setupBullets(): void {
    this.bullets = this.physics.add.group();

    this.physics.add.overlap(
      this.player,
      this.bullets,
      this.handleHit as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this
    );
  }

  private startSpawning(): void {
    if (this.spawnTimer) this.spawnTimer.destroy();
    this.spawnTimer = this.time.addEvent({
      delay: this.spawnDelay,
      callback: this.spawnBullet,
      callbackScope: this,
      loop: true,
    });
  }

  private spawnBullet(): void {
    if (!this.alive) return;

    const sides: BulletSide[] = ['top', 'bottom', 'left', 'right'];
    const side  = sides[Math.floor(Math.random() * 4)];
    const speed = this.bulletSpeed;
    const spread = 0.22;

    let x: number, y: number, vx: number, vy: number;

    switch (side) {
      case 'top':
        x  = Phaser.Math.Between(30, GAME_WIDTH - 30);
        y  = -32;
        vx = (Math.random() - 0.5) * speed * spread;
        vy = speed;
        break;
      case 'bottom':
        x  = Phaser.Math.Between(30, GAME_WIDTH - 30);
        y  = GAME_HEIGHT + 32;
        vx = (Math.random() - 0.5) * speed * spread;
        vy = -speed;
        break;
      case 'left':
        x  = -32;
        y  = Phaser.Math.Between(30, GAME_HEIGHT - 30);
        vx = speed;
        vy = (Math.random() - 0.5) * speed * spread;
        break;
      default: // right
        x  = GAME_WIDTH + 32;
        y  = Phaser.Math.Between(30, GAME_HEIGHT - 30);
        vx = -speed;
        vy = (Math.random() - 0.5) * speed * spread;
        break;
    }

    const bullet = this.bullets.create(x, y, `bullet_${side}`) as Phaser.Physics.Arcade.Image;
    (bullet.body as Phaser.Physics.Arcade.Body).setVelocity(vx, vy);
    bullet.setDepth(5);
  }

  // ─── Difficulty escalation ─────────────────────────────────────────────────

  private setupDifficultyEscalation(): void {
    this.time.addEvent({
      delay: 5000,
      loop: true,
      callback: () => {
        if (!this.alive) return;

        if (this.spawnDelay > this.MIN_SPAWN_DELAY) {
          this.spawnDelay = Math.max(this.MIN_SPAWN_DELAY, this.spawnDelay - 45);
          this.startSpawning();
        }
        if (this.bulletSpeed < this.MAX_BULLET_SPEED) {
          this.bulletSpeed = Math.min(this.MAX_BULLET_SPEED, this.bulletSpeed + 28);
        }
      },
    });
  }

  // ─── HUD ───────────────────────────────────────────────────────────────────

  private setupHUD(): void {
    // Survival timer — top center
    this.timerText = this.add.text(GAME_WIDTH / 2, 20, '0.0s', {
      fontFamily: 'monospace',
      fontSize:   '38px',
      color:      '#ffffff',
      stroke:     '#0a1628',
      strokeThickness: 5,
    }).setOrigin(0.5, 0).setDepth(20);

    // Lives — top right
    this.livesDisplay = this.add.text(GAME_WIDTH - 18, 20, '♥ ♥ ♥', {
      fontFamily: 'sans-serif',
      fontSize:   '26px',
      color:      '#ff4466',
      stroke:     '#000000',
      strokeThickness: 3,
    }).setOrigin(1, 0).setDepth(20);

    // Control hint — bottom center
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 16, 'WASD / Arrow Keys', {
      fontFamily: 'sans-serif',
      fontSize:   '14px',
      color:      '#ffffff',
    }).setOrigin(0.5, 1).setAlpha(0.38).setDepth(20);
  }

  private updateLivesDisplay(): void {
    const filled = '♥ '.repeat(this.lives).trimEnd();
    const empty  = ' ♡'.repeat(3 - this.lives).trimStart();
    this.livesDisplay.setText((filled + (this.lives < 3 ? ' ' + empty : '')).trim());
  }

  // ─── Collision handling ────────────────────────────────────────────────────

  private handleHit(
    _player: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
    bullet:  Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile
  ): void {
    if (this.invincible) return;

    (bullet as Phaser.GameObjects.Image).destroy();
    this.lives = Math.max(0, this.lives - 1);
    this.updateLivesDisplay();

    if (this.lives <= 0) {
      this.killPlayer();
    } else {
      this.invincible = true;
      this.cameras.main.shake(220, 0.009);

      // Screen red flash
      const flash = this.add
        .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xff0000, 0.28)
        .setDepth(50);
      this.tweens.add({
        targets:  flash,
        alpha:    0,
        duration: 220,
        onComplete: () => flash.destroy(),
      });

      // Player blink
      this.tweens.add({
        targets:  this.player,
        alpha:    0.15,
        duration: 90,
        yoyo:     true,
        repeat:   7,
        onComplete: () => {
          if (this.player.active) this.player.setAlpha(1);
          this.invincible = false;
        },
      });
    }
  }

  // ─── Death ─────────────────────────────────────────────────────────────────

  private killPlayer(): void {
    this.alive = false;
    if (this.spawnTimer) this.spawnTimer.paused = true;
    this.exhaustEmitter.stop();

    // Explosion burst
    const boom = this.add.particles(this.player.x, this.player.y, 'exhaust_p', {
      speed:    { min: 70, max: 360 },
      scale:    { start: 2.5, end: 0 },
      alpha:    { start: 1, end: 0 },
      lifespan: 750,
      quantity: 50,
      emitting: false,
    });
    boom.explode(50);
    boom.setDepth(15);

    this.cameras.main.shake(460, 0.018);
    this.player.setVisible(false);

    const finalTime = this.survivalTime;
    if (Math.floor(finalTime) > this.bestTime) {
      this.bestTime = Math.floor(finalTime);
      this.saveBestTime(this.bestTime);
    }

    this.time.delayedCall(900, () => this.showGameOver(finalTime));
  }

  // ─── Game-over panel ───────────────────────────────────────────────────────

  private showGameOver(seconds: number): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const pw = 520, ph = 320;

    // Panel
    const panel = this.add.graphics().setDepth(100).setAlpha(0);
    panel.fillStyle(0x000e1f, 0.88);
    panel.fillRoundedRect(cx - pw / 2, cy - ph / 2, pw, ph, 18);
    panel.lineStyle(2, 0x00b4d8, 0.9);
    panel.strokeRoundedRect(cx - pw / 2, cy - ph / 2, pw, ph, 18);

    const title = this.add.text(cx, cy - 110, 'GAME OVER', {
      fontFamily: 'monospace',
      fontSize:   '52px',
      color:      '#ff4466',
      stroke:     '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(101).setAlpha(0).setScale(0.5);

    this.add.text(cx, cy - 28, `Survived: ${seconds.toFixed(1)}s`, {
      fontFamily: 'monospace',
      fontSize:   '30px',
      color:      '#ffffff',
    }).setOrigin(0.5).setDepth(101).setAlpha(0);

    this.add.text(cx, cy + 20, `Best: ${this.bestTime}s`, {
      fontFamily: 'monospace',
      fontSize:   '22px',
      color:      '#ffdd00',
    }).setOrigin(0.5).setDepth(101).setAlpha(0);

    const restartBtn = this.add.text(cx, cy + 82, '▶  PRESS SPACE / CLICK TO RETRY', {
      fontFamily: 'monospace',
      fontSize:   '18px',
      color:      '#00d4ff',
      stroke:     '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(101).setAlpha(0).setInteractive({ useHandCursor: true });

    // Fade all in
    const allText = this.children.list.filter(
      c => c instanceof Phaser.GameObjects.Text && (c as Phaser.GameObjects.Text).depth >= 101
    );
    this.tweens.add({ targets: [panel, ...allText], alpha: 1, duration: 300, ease: 'Power2' });
    this.tweens.add({ targets: title, scaleX: 1, scaleY: 1, duration: 340, ease: 'Back.easeOut' });

    // Restart
    const restart = (): void => { this.scene.restart(); };
    this.input.keyboard!.once('keydown-SPACE', restart);
    restartBtn.once('pointerdown', restart);
  }

  // ─── Persistence ───────────────────────────────────────────────────────────

  private async loadBestTime(): Promise<void> {
    try {
      const { umicatReady } = await import('../main');
      const umicat = await umicatReady;
      if (umicat) {
        const saved = await umicat.saves.get<number>('highScore');
        if (typeof saved === 'number' && saved > this.bestTime) {
          this.bestTime = saved;
        }
      }
    } catch {
      // Platform saves unavailable — game still works
    }
  }

  private async saveBestTime(seconds: number): Promise<void> {
    try {
      const { umicatReady } = await import('../main');
      const umicat = await umicatReady;
      if (umicat) {
        await umicat.saves.set('highScore', seconds);
      }
    } catch {
      console.warn('[BulletDodge] Could not save best time');
    }
  }

  // ─── Update loop ───────────────────────────────────────────────────────────

  update(_time: number, delta: number): void {
    if (!this.alive) return;

    this.survivalTime += delta / 1000;

    // Update timer text
    this.timerText.setText(`${this.survivalTime.toFixed(1)}s`);

    // Shift timer color white → orange → red as danger grows (after 15 s)
    const danger = Math.min(1, Math.max(0, (this.survivalTime - 15) / 45));
    if (danger > 0) {
      const r = 255;
      const g = Math.floor(255 * (1 - danger * 0.85));
      const b = Math.floor(255 * (1 - danger));
      this.timerText.setColor(
        `#${r.toString(16).padStart(2, '0')}` +
        `${g.toString(16).padStart(2, '0')}` +
        `${b.toString(16).padStart(2, '0')}`
      );
    }

    // Movement input
    let vx = 0, vy = 0;
    if (this.cursors.left.isDown  || this.wasd.left.isDown)  vx = -this.PLAYER_SPEED;
    if (this.cursors.right.isDown || this.wasd.right.isDown) vx =  this.PLAYER_SPEED;
    if (this.cursors.up.isDown    || this.wasd.up.isDown)    vy = -this.PLAYER_SPEED;
    if (this.cursors.down.isDown  || this.wasd.down.isDown)  vy =  this.PLAYER_SPEED;

    // Normalize diagonal
    if (vx !== 0 && vy !== 0) { vx *= 0.7071; vy *= 0.7071; }

    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(vx, vy);

    // Subtle bank tilt
    const targetRot = vx * 0.014;
    this.player.setRotation(Phaser.Math.Linear(this.player.rotation, targetRot, 0.1));

    // Exhaust emitter follows behind the engines
    const behindX = this.player.x + Math.sin(this.player.rotation) * 6;
    const behindY = this.player.y + 26 * Math.cos(this.player.rotation);
    this.exhaustEmitter.setPosition(behindX, behindY);

    // Cull off-screen bullets
    this.bullets.getChildren().forEach(b => {
      const img = b as Phaser.Physics.Arcade.Image;
      if (!img.active) return;
      if (img.x < -100 || img.x > GAME_WIDTH + 100 ||
          img.y < -100 || img.y > GAME_HEIGHT + 100) {
        img.destroy();
      }
    });
  }
}
