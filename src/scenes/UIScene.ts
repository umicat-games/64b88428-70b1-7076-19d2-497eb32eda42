import Phaser from 'phaser';

/**
 * UIScene — HUD overlay (runs in parallel with GameScene).
 * For Bullet Dodge, all HUD elements are rendered inside GameScene directly.
 */
export class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    // HUD is handled by GameScene for this game
  }
}
