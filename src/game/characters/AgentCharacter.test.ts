/**
 * AgentCharacter - 无重力模式测试
 * 
 * P0 任务：去掉重力物理，改用纯 2D 移动
 * 
 * 验证点：
 * 1. 游戏配置中 gravity.y = 0
 * 2. Agent 不再受重力影响
 * 3. 导航使用纯 2D 移动（无跳跃）
 * 4. Agent 之间无物理碰撞
 */

import { gameConfig, PHYSICS_CONFIG } from '../config/gameConfig';

describe('AgentCharacter - 无重力模式', () => {
  describe('游戏配置', () => {
    it('应该将重力设置为 0', () => {
      expect(gameConfig.physics.arcade.gravity.y).toBe(0);
    });

    it('应该将物理配置中的重力设置为 0', () => {
      expect(PHYSICS_CONFIG.gravity).toBe(0);
    });

    it('应该将跳跃力设置为 0（不需要跳跃）', () => {
      expect(PHYSICS_CONFIG.jumpForce).toBe(0);
    });
  });

  describe('导航模式', () => {
    it('应该使用 drag 在 X 和 Y 方向', () => {
      // 无重力模式下，X 和 Y 都需要 drag 来减速
      expect(PHYSICS_CONFIG.drag).toBeGreaterThan(0);
    });
  });
});
