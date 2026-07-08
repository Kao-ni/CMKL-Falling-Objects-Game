import Phaser from '../lib/phaser.js';
import { SCENE_KEYS } from '../common/scene-keys.js';
import { ASSET_KEYS, FALLING_OBJECT_FRAMES } from '../common/assets.js';

const FALLING_OBJECT_MIN_SPEED = 45;
const FALLING_OBJECT_MAX_SPEED = 90;
const FALLING_OBJECT_SPEED_PER_SCORE = 3;
const FALLING_OBJECT_MAX_SCORE_SPEED_BONUS = 260;
const FALLING_OBJECT_SPAWN_DELAY = 3000;
const JAR_SPEED = 420;
const CAUGHT_OBJECT_SCALE = 0.45;
const JAR_OPENING_HALF_WIDTH = 72;
const JAR_RIM_OFFSET_Y = -80;
const CAUGHT_OBJECT_GRAVITY = 900;
const STARTING_LIVES = 3;
const HIGH_SCORE_STORAGE_KEY = 'crafty-catch-high-score';
const BOMB_SPAWN_CHANCE = 5;
const BOMB_SCALE = 1.15;
const GOLD_COIN_SPAWN_CHANCE = 15;
const GOLD_COIN_SCORE = 5;
const GOLD_COIN_SCALE = 1.05;
const HEART_SPAWN_CHANCE = 10;
const HEART_SCALE = 1.05;

/**
 * @typedef {'normal' | 'bomb' | 'goldCoin' | 'heart'} FallingObjectType
 */

/**
 * @typedef {Phaser.GameObjects.Image & {
 *   speed: number,
 *   rotationSpeed: number,
 *   objectType: FallingObjectType
 * }} FallingObject
 */

/**
 * @typedef {{
 *   gameObject: Phaser.GameObjects.Image,
 *   offsetX: number,
 *   offsetY: number,
 *   targetOffsetY: number,
 *   velocityY: number,
 *   bounceCount: number
 * }} CaughtObject
 */

export class GameScene extends Phaser.Scene {
  constructor() {
    super({
      key: SCENE_KEYS.GAME_SCENE,
    });

    /** @type {FallingObject[]} */
    this.fallingObjects = [];
    /** @type {CaughtObject[]} */
    this.caughtObjects = [];
    /** @type {Phaser.GameObjects.Image | undefined} */
    this.jar = undefined;
    /** @type {Phaser.Types.Input.Keyboard.CursorKeys | undefined} */
    this.cursors = undefined;
    /** @type {Phaser.Time.TimerEvent | undefined} */
    this.spawnTimer = undefined;
    /** @type {Phaser.GameObjects.Text | undefined} */
    this.scoreText = undefined;
    /** @type {Phaser.GameObjects.Text | undefined} */
    this.livesText = undefined;
    /** @type {Phaser.GameObjects.Text | undefined} */
    this.highScoreText = undefined;
    /** @type {Phaser.GameObjects.Text | undefined} */
    this.gameOverText = undefined;
    /** @type {Phaser.GameObjects.Text | undefined} */
    this.restartText = undefined;
    this.score = 0;
    this.highScore = 0;
    this.lives = STARTING_LIVES;
    this.isGameOver = false;
  }

  /**
   * @public
   * Tied to the Phaser Scene lifecycle. Will run one time after the PRELOAD
   * logic is finished. Runs each time the Phaser Scene restarts.
   * @returns {void}
   */
  create() {
    // get scene width and height
    const { width, height } = this.scale;

    // add game background
    this.add.image(width / 2, height / 2, ASSET_KEYS.BACKGROUND);
    this.jar = this.add.image(width / 2, height - 30, ASSET_KEYS.JAR).setDepth(10);
    if (this.input.keyboard !== null) {
      this.cursors = this.input.keyboard.createCursorKeys();
    }

    this.fallingObjects = [];
    this.caughtObjects = [];
    this.score = 0;
    this.highScore = this.getHighScore();
    this.lives = STARTING_LIVES;
    this.isGameOver = false;
    this.scoreText = this.add.text(24, 22, 'Score: 0', {
      fontFamily: 'Arial',
      fontSize: '32px',
      color: '#ffffff',
      stroke: '#1c1611',
      strokeThickness: 5,
    });
    this.livesText = this.add.text(24, 62, `Lives: ${STARTING_LIVES}`, {
      fontFamily: 'Arial',
      fontSize: '32px',
      color: '#ffffff',
      stroke: '#1c1611',
      strokeThickness: 5,
    });
    this.highScoreText = this.add.text(24, 102, `High Score: ${this.highScore}`, {
      fontFamily: 'Arial',
      fontSize: '32px',
      color: '#ffffff',
      stroke: '#1c1611',
      strokeThickness: 5,
    });
    this.gameOverText = undefined;
    this.restartText = undefined;

    this.spawnTimer = this.time.addEvent({
      delay: FALLING_OBJECT_SPAWN_DELAY,
      callback: this.spawnFallingObject,
      callbackScope: this,
      loop: true,
    });
  }

  /**
   * @public
   * Tied to the Phaser Scene lifecycle. Runs once per game step.
   * @param {number} time
   * @param {number} delta
   * @returns {void}
   */
  update(time, delta) {
    if (this.isGameOver) {
      return;
    }

    const distanceMultiplier = delta / 1000;

    this.updateJarPosition(distanceMultiplier);
    this.updateCaughtObjects(distanceMultiplier);

    this.fallingObjects = this.fallingObjects.filter((fallingObject) => {
      const previousBottomY = fallingObject.y + fallingObject.displayHeight / 2;

      fallingObject.y += fallingObject.speed * distanceMultiplier;
      fallingObject.rotation += fallingObject.rotationSpeed * distanceMultiplier;

      if (fallingObject.objectType === 'bomb' && this.isBombHittingJar(fallingObject)) {
        this.explodeBomb(fallingObject.x, fallingObject.y);
        fallingObject.destroy();
        this.loseLife();
        return false;
      }

      if (this.isObjectEnteringJar(fallingObject, previousBottomY)) {
        this.catchFallingObject(fallingObject);
        this.applyCaughtObjectReward(fallingObject);
        return false;
      }

      if (fallingObject.y > this.scale.height + fallingObject.displayHeight) {
        fallingObject.destroy();
        if (fallingObject.objectType !== 'bomb' && fallingObject.objectType !== 'heart') {
          this.loseLife();
        }
        return false;
      }

      return true;
    });
  }

  /**
   * @private
   * @returns {void}
   */
  spawnFallingObject() {
    if (this.isGameOver) {
      return;
    }

    const { width } = this.scale;
    const objectRoll = Phaser.Math.Between(1, 100);
    /** @type {FallingObjectType} */
    const objectType =
      objectRoll <= BOMB_SPAWN_CHANCE
        ? 'bomb'
        : objectRoll <= BOMB_SPAWN_CHANCE + GOLD_COIN_SPAWN_CHANCE
          ? 'goldCoin'
          : objectRoll <= BOMB_SPAWN_CHANCE + GOLD_COIN_SPAWN_CHANCE + HEART_SPAWN_CHANCE
            ? 'heart'
            : 'normal';
    const x = Phaser.Math.Between(60, width - 60);
    let fallingObject;

    if (objectType === 'bomb') {
      fallingObject = /** @type {FallingObject} */ (this.add.image(x, -80, ASSET_KEYS.BOMB));
    } else if (objectType === 'goldCoin') {
      fallingObject = /** @type {FallingObject} */ (this.add.image(x, -80, ASSET_KEYS.GOLD_COIN));
    } else if (objectType === 'heart') {
      fallingObject = /** @type {FallingObject} */ (this.add.image(x, -80, ASSET_KEYS.HEART));
    } else {
      fallingObject = /** @type {FallingObject} */ (
        this.add.image(x, -80, ASSET_KEYS.OBJECTS, Phaser.Utils.Array.GetRandom(FALLING_OBJECT_FRAMES))
      );
    }

    fallingObject.setScale(this.getFallingObjectScale(objectType));
    fallingObject.speed = this.getFallingObjectSpeed();
    fallingObject.rotationSpeed = Phaser.Math.FloatBetween(-2, 2);
    fallingObject.objectType = objectType;

    this.fallingObjects.push(fallingObject);
  }

  /**
   * @private
   * @returns {number}
   */
  getFallingObjectSpeed() {
    const scoreSpeedBonus = Phaser.Math.Clamp(
      this.score * FALLING_OBJECT_SPEED_PER_SCORE,
      0,
      FALLING_OBJECT_MAX_SCORE_SPEED_BONUS,
    );

    return Phaser.Math.Between(FALLING_OBJECT_MIN_SPEED + scoreSpeedBonus, FALLING_OBJECT_MAX_SPEED + scoreSpeedBonus);
  }

  /**
   * @private
   * @param {FallingObjectType} objectType
   * @returns {number}
   */
  getFallingObjectScale(objectType) {
    if (objectType === 'bomb') {
      return BOMB_SCALE;
    }

    if (objectType === 'goldCoin') {
      return GOLD_COIN_SCALE;
    }

    if (objectType === 'heart') {
      return HEART_SCALE;
    }

    return 0.75;
  }

  /**
   * @private
   * @param {number} distanceMultiplier
   * @returns {void}
   */
  updateJarPosition(distanceMultiplier) {
    if (this.jar === undefined || this.cursors === undefined) {
      return;
    }

    if (this.cursors.left.isDown) {
      this.jar.x -= JAR_SPEED * distanceMultiplier;
    } else if (this.cursors.right.isDown) {
      this.jar.x += JAR_SPEED * distanceMultiplier;
    }

    const jarHalfWidth = this.jar.displayWidth / 2;
    this.jar.x = Phaser.Math.Clamp(this.jar.x, jarHalfWidth, this.scale.width - jarHalfWidth);
  }

  /**
   * @private
   * @param {number} distanceMultiplier
   * @returns {void}
   */
  updateCaughtObjects(distanceMultiplier) {
    if (this.jar === undefined) {
      return;
    }

    const jar = this.jar;

    this.caughtObjects.forEach((caughtObject) => {
      if (caughtObject.bounceCount < 2) {
        caughtObject.velocityY += CAUGHT_OBJECT_GRAVITY * distanceMultiplier;
        caughtObject.offsetY += caughtObject.velocityY * distanceMultiplier;

        if (caughtObject.offsetY >= caughtObject.targetOffsetY) {
          caughtObject.offsetY = caughtObject.targetOffsetY;
          caughtObject.velocityY *= -0.35;
          caughtObject.bounceCount += 1;
        }
      }

      caughtObject.gameObject.x = jar.x + caughtObject.offsetX;
      caughtObject.gameObject.y = jar.y + caughtObject.offsetY;
    });
  }

  /**
   * @private
   * @param {FallingObject} fallingObject
   * @param {number} previousBottomY
   * @returns {boolean}
   */
  isObjectEnteringJar(fallingObject, previousBottomY) {
    if (this.jar === undefined) {
      return false;
    }

    if (fallingObject.objectType === 'bomb') {
      return false;
    }

    const jarOpeningY = this.jar.y + JAR_RIM_OFFSET_Y;
    const objectCenterX = fallingObject.x;
    const objectBottomY = fallingObject.y + fallingObject.displayHeight / 2;
    const isInsideOpening = Math.abs(objectCenterX - this.jar.x) <= JAR_OPENING_HALF_WIDTH;
    const crossedOpening = previousBottomY < jarOpeningY && objectBottomY >= jarOpeningY;

    return isInsideOpening && crossedOpening;
  }

  /**
   * @private
   * @param {FallingObject} fallingObject
   * @returns {boolean}
   */
  isBombHittingJar(fallingObject) {
    if (this.jar === undefined) {
      return false;
    }

    return Phaser.Geom.Intersects.RectangleToRectangle(this.jar.getBounds(), fallingObject.getBounds());
  }

  /**
   * @private
   * @param {FallingObject} fallingObject
   * @returns {void}
   */
  catchFallingObject(fallingObject) {
    if (this.jar === undefined) {
      return;
    }

    const offsetX = Phaser.Math.Clamp(fallingObject.x - this.jar.x, -48, 48);
    const targetOffsetY = Phaser.Math.Between(-42, 8);

    fallingObject.setScale(CAUGHT_OBJECT_SCALE);
    fallingObject.setDepth(11);
    fallingObject.x = this.jar.x + offsetX;
    fallingObject.y = this.jar.y + JAR_RIM_OFFSET_Y;
    fallingObject.rotation = Phaser.Math.FloatBetween(-0.35, 0.35);

    this.caughtObjects.push({
      gameObject: fallingObject,
      offsetX,
      offsetY: JAR_RIM_OFFSET_Y,
      targetOffsetY,
      velocityY: 260,
      bounceCount: 0,
    });
  }

  /**
   * @private
   * @param {number} x
   * @param {number} y
   * @returns {void}
   */
  explodeBomb(x, y) {
    const explosion = this.add.graphics({ x, y }).setDepth(30);

    explosion.fillStyle(0xffd166, 1);
    explosion.fillCircle(0, 0, 28);
    explosion.lineStyle(8, 0xf25f5c, 1);
    explosion.strokeCircle(0, 0, 38);

    this.cameras.main.shake(180, 0.01);
    this.tweens.add({
      targets: explosion,
      alpha: 0,
      scale: 2.2,
      duration: 260,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        explosion.destroy();
      },
    });
  }

  /**
   * @private
   * @param {number} points
   * @returns {void}
   */
  increaseScore(points) {
    this.score += points;
    this.scoreText?.setText(`Score: ${this.score}`);

    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.saveHighScore();
      this.highScoreText?.setText(`High Score: ${this.highScore}`);
    }
  }

  /**
   * @private
   * @param {FallingObject} fallingObject
   * @returns {void}
   */
  applyCaughtObjectReward(fallingObject) {
    if (fallingObject.objectType === 'heart') {
      this.showHeartEffect(fallingObject.x, fallingObject.y);
      this.gainLife();
      return;
    }

    if (fallingObject.objectType === 'goldCoin') {
      this.showGoldCoinEffect(fallingObject.x, fallingObject.y);
    }

    this.increaseScore(fallingObject.objectType === 'goldCoin' ? GOLD_COIN_SCORE : 1);
  }

  /**
   * @private
   * @param {number} x
   * @param {number} y
   * @returns {void}
   */
  showGoldCoinEffect(x, y) {
    const sparkle = this.add.graphics({ x, y }).setDepth(30);

    sparkle.lineStyle(4, 0xfff1a8, 1);
    sparkle.strokeCircle(0, 0, 28);
    sparkle.lineBetween(-34, 0, 34, 0);
    sparkle.lineBetween(0, -34, 0, 34);
    sparkle.lineBetween(-24, -24, 24, 24);
    sparkle.lineBetween(-24, 24, 24, -24);

    const pointsText = this.add
      .text(x, y - 48, `+${GOLD_COIN_SCORE}`, {
        fontFamily: 'Arial',
        fontSize: '34px',
        color: '#ffe066',
        stroke: '#7a4f00',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(31);

    this.tweens.add({
      targets: sparkle,
      alpha: 0,
      angle: 90,
      scale: 1.8,
      duration: 420,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        sparkle.destroy();
      },
    });

    this.tweens.add({
      targets: pointsText,
      alpha: 0,
      y: y - 96,
      duration: 520,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        pointsText.destroy();
      },
    });
  }

  /**
   * @private
   * @param {number} x
   * @param {number} y
   * @returns {void}
   */
  showHeartEffect(x, y) {
    const pulse = this.add.graphics({ x, y }).setDepth(30);

    pulse.fillStyle(0xff5c8a, 0.26);
    pulse.fillCircle(0, 0, 36);
    pulse.lineStyle(5, 0xff2f66, 1);
    pulse.strokeCircle(0, 0, 34);

    const lifeText = this.add
      .text(x, y - 48, '+1 Life', {
        fontFamily: 'Arial',
        fontSize: '32px',
        color: '#ff6f91',
        stroke: '#6b1530',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(31);

    this.tweens.add({
      targets: pulse,
      alpha: 0,
      scale: 1.9,
      duration: 440,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        pulse.destroy();
      },
    });

    this.tweens.add({
      targets: lifeText,
      alpha: 0,
      y: y - 96,
      duration: 540,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        lifeText.destroy();
      },
    });
  }

  /**
   * @private
   * @returns {void}
   */
  gainLife() {
    this.lives += 1;
    this.livesText?.setText(`Lives: ${this.lives}`);
  }

  /**
   * @private
   * @returns {void}
   */
  loseLife() {
    this.lives -= 1;
    this.livesText?.setText(`Lives: ${this.lives}`);

    if (this.lives <= 0) {
      this.endGame();
    }
  }

  /**
   * @private
   * @returns {void}
   */
  endGame() {
    this.isGameOver = true;
    this.spawnTimer?.remove(false);
    this.fallingObjects.forEach((fallingObject) => fallingObject.destroy());
    this.fallingObjects = [];
    this.gameOverText = this.add
      .text(this.scale.width / 2, this.scale.height / 2, `Game Over\nScore: ${this.score}`, {
        fontFamily: 'Arial',
        fontSize: '56px',
        color: '#ffffff',
        align: 'center',
        stroke: '#1c1611',
        strokeThickness: 7,
      })
      .setOrigin(0.5)
      .setDepth(20);
    this.restartText = this.add
      .text(this.scale.width / 2, this.scale.height / 2 + 112, 'Restart', {
        fontFamily: 'Arial',
        fontSize: '38px',
        color: '#ffffff',
        backgroundColor: '#8d4f2d',
        padding: {
          x: 26,
          y: 14,
        },
      })
      .setOrigin(0.5)
      .setDepth(20)
      .setInteractive({ useHandCursor: true });

    this.restartText.on('pointerdown', () => {
      this.scene.restart();
    });
  }

  /**
   * @private
   * @returns {number}
   */
  getHighScore() {
    const storedHighScore = Number(window.localStorage.getItem(HIGH_SCORE_STORAGE_KEY));

    if (Number.isNaN(storedHighScore)) {
      return 0;
    }

    return storedHighScore;
  }

  /**
   * @private
   * @returns {void}
   */
  saveHighScore() {
    window.localStorage.setItem(HIGH_SCORE_STORAGE_KEY, `${this.highScore}`);
  }
}
