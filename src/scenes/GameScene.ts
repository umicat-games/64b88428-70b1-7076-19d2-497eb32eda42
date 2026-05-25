import Phaser from 'phaser';
import {
  loadWorldScene,
  getEntityRegistry,
  getManifest,
  applyAssetHitbox,
  addTilemapCollider,
} from '@umicat/phaser-sdk';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

const SPEED = 100;

export class GameScene extends Phaser.Scene {
  private sceneId!: string;
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: { sceneId: string }): void {
    this.sceneId = data.sceneId;
  }

  async create(): Promise<void> {
    const { sceneFile } = await loadWorldScene(this, this.sceneId);

    if (sceneFile.entities.length === 0) {
      this.add
        .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'Describe your game\nin the chat!', {
          fontSize: '28px',
          color: '#ffffff',
          align: 'center',
        })
        .setOrigin(0.5);
      return;
    }

    const registry = getEntityRegistry(this)!;
    this.player = registry.byRole('player')[0] as Phaser.Physics.Arcade.Sprite;
    if (!this.player) return;

    // Apply physics body to the player
    this.physics.add.existing(this.player);
    const manifest = getManifest(this);
    const asset = manifest.assets.find(
      (a: { id: string }) => a.id === this.player.getData('assetId')
    );
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if ((asset as any)?.hitbox) {
      applyAssetHitbox(this.player, asset as any);
    } else {
      // Foot-sized hitbox centred at the bottom of the 48×48 frame
      body.setSize(20, 12);
      body.setOffset(14, 34);
    }
    body.setCollideWorldBounds(true);

    // Collide player against all solid tilemap tiles
    addTilemapCollider(this, 'tilemap-mpkh2xwn-34mk', this.player);

    // Camera follows player within the world bounds
    this.cameras.main.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // Cursor keys (arrow keys)
    this.cursors = this.input.keyboard!.createCursorKeys();

    // Start player facing down (idle first frame)
    this.player.setFrame(0);
  }

  update(_time: number, _delta: number): void {
    if (!this.player) return;

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);

    const left  = this.cursors.left.isDown;
    const right = this.cursors.right.isDown;
    const up    = this.cursors.up.isDown;
    const down  = this.cursors.down.isDown;

    if (left) {
      body.setVelocityX(-SPEED);
      this.player.play('walk-left', true);
    } else if (right) {
      body.setVelocityX(SPEED);
      this.player.play('walk-right', true);
    } else if (up) {
      body.setVelocityY(-SPEED);
      this.player.play('walk-up', true);
    } else if (down) {
      body.setVelocityY(SPEED);
      this.player.play('walk-down', true);
    } else {
      this.player.stop();
    }
  }
}
