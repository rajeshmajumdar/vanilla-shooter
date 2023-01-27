function grayScaleFilter(color) {
  return color.grayScale();
}

function idFilter(color) {
  return color;
}

let globalFillFilter = idFilter;

function fillCircle(context, center, radius, color) {
  context.beginPath();
  context.arc(center.x, center.y, radius, 0, 2 * Math.PI, false);
  context.fillStyle = globalFillFilter(color).toRgba();
  context.fill();
}

function fillRect(context, x, y, w, h, color) {
  context.fillStyle = globalFillFilter(color).toRgba();
  context.fillRect(x, y, w, h);
}

class Color {
  constructor(r, g, b, a) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
  }

  toRgba() {
    return `rgba(${this.r * 255}, ${this.g * 255}, ${this.b * 255}, ${this.a})`;
  }

  withAlpha(a) {
    return new Color(this.r, this.g, this.b, a);
  }

  grayScale() {
    let x = (this.r + this.g + this.b) / 3;
    return new Color(x, x, x, this.a);
  }

  invert() {
    return new Color(1.0 - this.r, 1.0 - this.g, 1.0 - this.b, this.a);
  }

  static hex(hexcolor) {
    let matches = hexcolor.match(/#([0-9a-z]{2})([0-9a-z]{2})([0-9a-z]{2})/i);
    if (matches) {
      let [, r, g, b] = matches;
      return new Color(parseInt(r, 16) / 255.0,
                parseInt(g, 16) / 255.0,
                parseInt(b, 16) / 255.0,
                1.0);
    } else {
    throw `Could not parse ${hexcolor} as color`;
    }
  }
}

class V2 {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  add(that) {
    return new V2(this.x + that.x, this.y + that.y);
  }

  sub(that) {
    return new V2(this.x - that.x, this.y - that.y);
  }

  scale(s) {
    return new V2(this.x * s, this.y * s);
  }

  len() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  normalize() {
    const n = this.len();
    return new V2(this.x / n, this.y / n);
  }

  dist(that) {
    return this.sub(that).len();
  }

  static polar(mag, dir) {
    return new V2(Math.cos(dir) * mag, Math.sin(dir) * mag);
  }
}

const directionMap = {
  'w': new V2(0, -1.0),
  'a': new V2(-1.0, 0),
  's': new V2(0, 1.0),
  'd': new V2(1.0, 0),
}

const PLAYER_COLOR = Color.hex("#f43841");
const PLAYER_RADIUS = 25;
const PLAYER_SPEED = 250;
const PLAYER_MAX_HEALTH = 100;

const BULLET_SPEED = 500;
const BULLET_RADIUS = 10;
const BULLET_LIFETIME = 2.0;

const TUTORIAL_POPUP_SPEED = 1.7;

const ENEMY_COLOR = Color.hex("#9e95c7");
const ENEMY_SPEED = PLAYER_SPEED / 3;
const ENEMY_RADIUS = PLAYER_RADIUS / 2;
const ENEMY_SPAWN_COOLDOWN = 1.0;
const ENEMY_SPAWN_DISTANCE = 1000.0;
const ENEMY_DAMAGE = PLAYER_MAX_HEALTH / 10;
const ENEMY_KILL_POINT = 1;

const PARTICLE_RADIUS = 8.0;
const PARTICLES_COUNT = 50;
const PARTICLE_MAG = BULLET_SPEED;
const PARTICLE_LIFETIME = 1.0;

const MESSAGE_COLOR = Color.hex("#ffffff");
const HEALTH_BAR_HEIGHT = 10.0;
const HEALTH_PER_KILL = ENEMY_DAMAGE / 3;

const TutorialState = Object.freeze({
  "LearningMovement": 0,
  "LearningShooting": 1,
  "Finished": 2,
});
const TutorialMessages = Object.freeze([
  "WASD to move around",
  "Left click to shoot",
  ""
]);

function fillMessage(context, text, color) {
  const width = context.canvas.width;
  const height = context.canvas.height;

  context.fillStyle = color.toRgba();
  context.font = "30px JosefinSans"
  context.textAlign = "center";
  context.fillText(text, width/2, height/2)
}

// TODO: Write this class
class Camera {
  pos = new V2(0.0, 0.0);
  grayness = 0.0;

  update(dt) {
  }
}

class Popup {
  constructor(text) {
    this.text = text;
    this.alpha = 0.0;
    this.da = 0.0;
    this.onFadedOut = undefined;
    this.onFadedIn = undefined;
  }

  update(dt) {
    this.alpha += this.da * dt;

    if(this.da < 0.0 && this.alpha <= 0.0) {
      this.da = 0.0;
      this.alpha = 0.0;

      this.onFadedOut?.();
    } else if(this.da > 0.0 && this.alpha >= 1.0) {
      this.da = 0.0;
      this.alpha = 1.0;

      this.onFadedIn?.();
    }
  }

  render(context) {
    fillMessage(context, this.text, MESSAGE_COLOR.withAlpha(this.alpha));
  }

  fadeIn() {
    this.da = TUTORIAL_POPUP_SPEED;
  }

  fadeOut() {
    this.da = -TUTORIAL_POPUP_SPEED;
  }
}

class Tutorial {
  constructor() {
    this.state = 0;
    this.popup = new Popup(TutorialMessages[this.state]);
    this.popup.fadeIn();
    this.popup.onFadedOut = () => {
      this.popup.text = TutorialMessages[this.state];
      this.popup.fadeIn();
    };
  }

  update(dt) {
    this.popup.update(dt);
  }

  render(context) {
    this.popup.render(context);
  }

  playerMoved() {
    if (this.state == TutorialState.LearningMovement) {
      this.popup.fadeOut();
      this.state += 1;
    }
  }

  playerShot() {
    if (this.state == TutorialState.LearningShooting) {
      this.popup.fadeOut();
      this.state += 1;
    }
  }
}

class Bullet {
  constructor(pos, vel) {
    this.pos = pos;
    this.vel = vel;
    this.lifetime = BULLET_LIFETIME;
  }

  update(dt) {
    this.pos = this.pos.add(this.vel.scale(dt));
    this.lifetime -= dt;
  }

  render(context) {
    fillCircle(context, this.pos, BULLET_RADIUS, PLAYER_COLOR);
  }
}

class Particle {
  constructor(pos, vel, lifetime, radius, color) {
    this.pos = pos;
    this.vel = vel;
    this.lifetime = lifetime;
    this.radius = radius;
    this.color = color;
  }

  render(context) {
    const a = this.lifetime / PARTICLE_LIFETIME;
    fillCircle(context, this.pos, this.radius, this.color.withAlpha(a));
  }

  update(dt) {
    this.pos = this.pos.add(this.vel.scale(dt));
    this.lifetime -= dt;
  }
}

function particleBurst(particles, center, color) {
  for (let i = 0; i < Math.random() * PARTICLES_COUNT; ++i) {
    particles.push(new Particle(
      center,
      V2.polar(Math.random() * PARTICLE_MAG, Math.random() * 2 * Math.PI),
      Math.random() * PARTICLE_LIFETIME,
      Math.random() * PARTICLE_RADIUS,
      color));
  }
}

class Enemy {
  constructor(pos) {
    this.pos = pos;
    this.dead = false;
  }

  update(dt, followPos) {
    let vel = followPos
                .sub(this.pos)
                .normalize()
                .scale(ENEMY_SPEED * dt);
    this.pos = this.pos.add(vel);
  }

  render(context) {
    fillCircle(context, this.pos, ENEMY_RADIUS, ENEMY_COLOR);
  }
}

function renderEntities(context, entities) {
  for (let entity of entities) {
    entity.render(context);
  }
}

class Player {
  health = PLAYER_MAX_HEALTH;

  constructor(pos) {
    this.pos = pos;
  }

  update(dt, vel) {
    this.pos = this.pos.add(vel.scale(dt));
  }

  render(context) {
    if (this.health > 0.0) {
      fillCircle(context, this.pos, PLAYER_RADIUS, PLAYER_COLOR);
    }
  }

  shootAt(target) {
    const bulletDir = target
          .sub(this.pos)
          .normalize();
    const bulletVel = bulletDir.scale(BULLET_SPEED);
    const bulletPos = this
          .pos
          .add(bulletDir.scale(PLAYER_RADIUS + BULLET_RADIUS));

    return new Bullet(bulletPos, bulletVel);
  }

  damage(value) {
    this.health = Math.max(this.health - value, 0.0);
  }
}

class Game {
  player = new Player(new V2(PLAYER_RADIUS + 10, PLAYER_RADIUS + 10));
  pressedKeys = new Set();
  bullets = [];
  tutorial = new Tutorial();
  mousePos = new V2(0, 0);
  enemies = [];
  particles = [];
  enemySpawnRate = ENEMY_SPAWN_COOLDOWN;
  enemySpawnCooldown = this.enemySpawnRate;
  pause = false;
  score = 0;

  update(dt) {
    if (this.pause) {
      return;
    }

    if (this.player.health <= 0.0) {
      dt /= 50;
    }

    let moved = false;
    let vel = new V2(0, 0);
    for(let key of this.pressedKeys) {
      if (key in directionMap) {
        vel = vel.add(directionMap[key].scale(PLAYER_SPEED));
        moved = true;
      }
    }

    if (moved) {
      this.tutorial.playerMoved();
    }

    this.player.update(dt, vel);
    this.tutorial.update(dt);

    for (let enemy of this.enemies) {
      if (!enemy.dead) {
        for (let bullet of this.bullets) {
          if (enemy.pos.dist(bullet.pos) <= BULLET_RADIUS + ENEMY_RADIUS) {
            enemy.dead = true;
            bullet.lifetime = 0.0;
            this.score += ENEMY_KILL_POINT;
            particleBurst(this.particles, enemy.pos, ENEMY_COLOR);
            this.player.health = Math.min(this.player.health + HEALTH_PER_KILL, PLAYER_MAX_HEALTH);
          }
        }
      }
      if (this.player.health > 0.0 && !enemy.dead) {
        if (enemy.pos.dist(this.player.pos) <= ENEMY_RADIUS + PLAYER_RADIUS) {
          enemy.dead = true;
          this.player.damage(ENEMY_DAMAGE);
          particleBurst(this.particles, enemy.pos, PLAYER_COLOR);
        }
      }
    }

    for(let bullet of this.bullets) {
      bullet.update(dt);
    }
    this.bullets = this.bullets.filter(bullet => bullet.lifetime > 0.0);

    for(let enemy of this.enemies) {
      enemy.update(dt, this.player.pos);
    }
    this.enemies = this.enemies.filter(enemy => !enemy.dead);

    for(let particle of this.particles) {
      particle.update(dt);
    }
    this.particles = this.particles.filter(particle => particle.lifetime > 0.0);

    if (this.tutorial.state == TutorialState.Finished) {
      this.enemySpawnCooldown -= dt;
      if (this.enemySpawnCooldown <= 0.0) {
        this.spawnEnemy();
        this.enemySpawnCooldown = this.enemySpawnRate;
        this.enemySpawnRate = Math.max(0.01, this.enemySpawnRate - 0.01);
      }
    }
  }

  render(ctx) {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    ctx.clearRect(0, 0, width, height);
    this.player.render(ctx);

    renderEntities(ctx, this.bullets);
    renderEntities(ctx, this.particles);
    renderEntities(ctx, this.enemies);

    if (this.player.health <= 0.0) {
      fillMessage(ctx, `Your score: ${this.score} (Press R to restart)`, MESSAGE_COLOR);
      globalFillFilter = grayScaleFilter;
    }

    if (!this.pause) {
      this.tutorial.render(ctx);
    } else {
      fillMessage(ctx, "PAUSED (Press SPACE to continue)", MESSAGE_COLOR);
    }

    fillRect(ctx, 0, height - HEALTH_BAR_HEIGHT, width * (this.player.health / PLAYER_MAX_HEALTH), HEALTH_BAR_HEIGHT, PLAYER_COLOR);

  }

  spawnEnemy() {
    let dir = Math.random() * 2 * Math.PI;
    this.enemies.push(new Enemy(this.player.pos.add(V2.polar(ENEMY_SPAWN_DISTANCE, dir))));
  }

  togglePause() {
    this.pause = !this.pause;
    if (this.pause) {
      globalFillFilter = grayScaleFilter;
    } else {
      globalFillFilter = idFilter;
    }
  }

  keyDown(event) {
    if (this.player.health <= 0.0) {
      return;
    }
    if (event.key == ' ') {
      this.togglePause();
    }
    this.pressedKeys.add(event.key);
  }
 
  keyUp(event) {
    this.pressedKeys.delete(event.key);
  }

  mouseMove(event) {
  }
 
  mouseDown(event) {
    if (this.pause || this.player.health <= 0.0) {
      return;
    }

    this.tutorial.playerShot();
    const mousePos = new V2(event.offsetX, event.offsetY);
    this.bullets.push(this.player.shootAt(mousePos));
  }
}

const game = new Game();

(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  let start;
  let windowWasResized = true;

  function step(timestamp) {
    if (start == undefined)
      start = timestamp;
    const dt = (timestamp - start) / 1000.0;
    start = timestamp;

    if (windowWasResized) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      windowWasResized = false;
    }

    game.update(dt);
    game.render(ctx);

    window.requestAnimationFrame(step);
  }

  window.requestAnimationFrame(step);

  document.addEventListener('keydown', event => {
    game.keyDown(event);
  });
  document.addEventListener('keyup', event => {
    game.keyUp(event);
  });
  document.addEventListener('mousemove', event => {
    game.mouseMove(event);
  });
  document.addEventListener('mousedown', event => {
    game.mouseDown(event);
  })

  window.addEventListener('resize', event => {
    windowWasResized = true;
  })

})();
