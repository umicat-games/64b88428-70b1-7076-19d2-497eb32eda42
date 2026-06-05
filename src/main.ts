import { createUmicatGame, Umicat } from '@umicat/phaser-sdk';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { GAME_WIDTH, GAME_HEIGHT } from './config';
import { renderScripts } from './visuals';

// Platform services — resolves to Umicat instance or null (anonymous/offline)
export const umicatReady = Umicat.init({ standaloneGameId: 'umicat-game' }).catch(() => null);

createUmicatGame({
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  scenes: [BootScene, GameScene, UIScene],
  renderScripts,
});
