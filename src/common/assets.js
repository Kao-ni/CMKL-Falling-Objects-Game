export const ASSET_KEYS = Object.freeze({
  BACKGROUND: 'BACKGROUND',
  OBJECTS: 'OBJECTS',
  JAR: 'JAR',
  BOMB: 'BOMB',
  GOLD_COIN: 'GOLD_COIN',
  HEART: 'HEART',
});

export const FALLING_OBJECT_FRAMES = [
  'button1.png',
  'button2.png',
  'button3.png',
  'button4.png',
  'button5.png',
  'needle_pin1.png',
  'needle_pin2.png',
  'needle_pin3.png',
  'needle_pin4.png',
  'needle_pin5.png',
  'thread1.png',
  'thread2.png',
  'thread3.png',
];

export const IMAGE_ASSETS = [
  {
    assetKey: ASSET_KEYS.BACKGROUND,
    path: 'assets/images/background.png',
  },
  {
    assetKey: ASSET_KEYS.JAR,
    path: 'assets/images/jar.png',
  },
  {
    assetKey: ASSET_KEYS.BOMB,
    path: 'assets/images/bomb.png',
  },
  {
    assetKey: ASSET_KEYS.GOLD_COIN,
    path: 'assets/images/gold-coin.png',
  },
  {
    assetKey: ASSET_KEYS.HEART,
    path: 'assets/images/heart.png',
  },
];

export const TEXTURE_ATLAS_ASSETS = [
  {
    assetKey: ASSET_KEYS.OBJECTS,
    textureURL: 'assets/images/spritesheet.png',
    atlasURL: 'assets/images/spritesheet.json',
  },
];
