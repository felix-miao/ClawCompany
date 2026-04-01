import Phaser from 'phaser';
import { AgentCharacter, createAgent } from '../characters/AgentCharacter';
import { PHYSICS_CONFIG, TILE_SIZE } from '../config/gameConfig';
import { DebugOverlay } from '../utils/DebugOverlay';
import { MovementSystem } from '../systems/MovementSystem';

interface Workstation {
  id: string;
  x: number;
  y: number;
  label: string;
}

interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
  type: string;
}

interface TilemapData {
  width: number;
  height: number;
  tileSize: number;
  workstations: Workstation[];
  platforms: Platform[];
}

export class OfficeScene extends Phaser.Scene {
  private agents: AgentCharacter[] = [];
  private platforms: Phaser.Physics.Arcade.StaticGroup;
  private debugOverlay!: DebugOverlay;
  private movementSystem!: MovementSystem;
  private tilemapData: TilemapData | null = null;

  constructor() {
    super({ key: 'OfficeScene' });
    this.platforms = this.physics.add.staticGroup();
  }

  async preload(): Promise<void> {
    try {
      const response = await fetch('/assets/office-tilemap.json');
      this.tilemapData = await response.json();
    } catch (error) {
      console.warn('Failed to load tilemap, using defaults');
      this.tilemapData = {
        width: 20,
        height: 15,
        tileSize: 32,
        workstations: [
          { id: 'ws1', x: 4, y: 8, label: 'Dev1' },
          { id: 'ws2', x: 8, y: 8, label: 'Dev2' },
          { id: 'ws3', x: 12, y: 8, label: 'PM' },
          { id: 'ws4', x: 16, y: 8, label: 'Review' },
        ],
        platforms: [
          { x: 0, y: 14, width: 20, height: 1, type: 'floor' },
          { x: 0, y: 0, width: 1, height: 14, type: 'wall_left' },
          { x: 19, y: 0, width: 1, height: 14, type: 'wall_right' },
          { x: 2, y: 9, width: 4, height: 0.5, type: 'desk' },
          { x: 6, y: 9, width: 4, height: 0.5, type: 'desk' },
          { x: 10, y: 9, width: 4, height: 0.5, type: 'desk' },
          { x: 14, y: 9, width: 4, height: 0.5, type: 'desk' },
        ],
      };
    }
  }

  create(): void {
    this.createPlatforms();
    this.createAgents();
    this.setupCollisions();
    this.setupDebug();
    this.movementSystem = new MovementSystem(this);
    if (this.agents.length > 0) {
      this.movementSystem.setActiveAgent(this.agents[0]);
    }
  }

  private createPlatforms(): void {
    if (!this.tilemapData) return;

    const platformColors: Record<string, number> = {
      floor: 0x888888,
      wall_left: 0x666666,
      wall_right: 0x666666,
      desk: 0x4a3728,
    };

    this.tilemapData.platforms.forEach((platform) => {
      const x = platform.x * TILE_SIZE + (platform.width * TILE_SIZE) / 2;
      const y = platform.y * TILE_SIZE + (platform.height * TILE_SIZE) / 2;
      const width = platform.width * TILE_SIZE;
      const height = platform.height * TILE_SIZE;

      const graphics = this.add.graphics();
      graphics.fillStyle(platformColors[platform.type] || 0x888888, 1);
      graphics.fillRect(-width / 2, -height / 2, width, height);
      graphics.generateTexture(`platform_${platform.type}`, width, height);
      graphics.destroy();

      const platformSprite = this.platforms.create(x, y, `platform_${platform.type}`);
      platformSprite.setOrigin(0.5, 0.5);
      platformSprite.refreshBody();
    });
  }

  private createAgents(): void {
    if (!this.tilemapData) return;

    const agentColors = [0xff6b6b, 0x4ecdc4, 0x45b7d1, 0x96ceb4];

    this.tilemapData.workstations.forEach((ws, index) => {
      const x = ws.x * TILE_SIZE + TILE_SIZE / 2;
      const y = (ws.y - 1) * TILE_SIZE;
      const agent = createAgent(this, x, y, agentColors[index]);
      this.agents.push(agent);
    });
  }

  private setupCollisions(): void {
    this.agents.forEach((agent) => {
      this.physics.add.collider(agent, this.platforms);
    });
  }

  private setupDebug(): void {
    this.debugOverlay = new DebugOverlay(this);
  }

  update(): void {
    this.agents.forEach((agent) => agent.update());
    this.movementSystem.update();
    this.debugOverlay.update(this.agents);
  }

  toggleDebug(): void {
    this.physics.world.drawDebug = !this.physics.world.drawDebug;
  }
}