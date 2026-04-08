import { EmotionSystem, EmotionType } from '../EmotionSystem';

describe('EmotionSystem', () => {
  let emotionSystem: EmotionSystem;

  beforeEach(() => {
    emotionSystem = new EmotionSystem();
  });

  describe('constructor', () => {
    it('should initialize with no active emotions', () => {
      expect(emotionSystem.getActiveEmotion()).toBeNull();
    });

    it('should initialize with default config', () => {
      const config = emotionSystem.getConfig();
      expect(config.bubbleWidth).toBe(48);
      expect(config.bubbleHeight).toBe(40);
      expect(config.fontSize).toBe(20);
      expect(config.defaultDuration).toBe(5000);
    });

    it('should accept custom config', () => {
      const custom = new EmotionSystem({ bubbleWidth: 64, fontSize: 24 });
      const config = custom.getConfig();
      expect(config.bubbleWidth).toBe(64);
      expect(config.fontSize).toBe(24);
    });
  });

  describe('setEmotion', () => {
    it('should set an emotion and return true', () => {
      const result = emotionSystem.setEmotion('focused');
      expect(result).toBe(true);
      expect(emotionSystem.getActiveEmotion()).toBe('focused');
    });

    it('should set emotion with custom duration', () => {
      emotionSystem.setEmotion('thinking', 3000);
      expect(emotionSystem.getActiveEmotion()).toBe('thinking');
      expect(emotionSystem.getRemainingDuration()).toBe(3000);
    });

    it('should override previous emotion', () => {
      emotionSystem.setEmotion('focused');
      emotionSystem.setEmotion('happy');
      expect(emotionSystem.getActiveEmotion()).toBe('happy');
    });

    it('should reject invalid emotion types', () => {
      const result = emotionSystem.setEmotion('invalid' as EmotionType);
      expect(result).toBe(false);
      expect(emotionSystem.getActiveEmotion()).toBeNull();
    });
  });

  describe('clearEmotion', () => {
    it('should clear active emotion', () => {
      emotionSystem.setEmotion('focused');
      emotionSystem.clearEmotion();
      expect(emotionSystem.getActiveEmotion()).toBeNull();
    });

    it('should be safe to call when no emotion is active', () => {
      expect(() => emotionSystem.clearEmotion()).not.toThrow();
    });
  });

  describe('update', () => {
    it('should count down emotion duration', () => {
      emotionSystem.setEmotion('focused', 100);
      emotionSystem.update(50);
      expect(emotionSystem.getRemainingDuration()).toBe(50);
    });

    it('should auto-clear emotion when duration expires', () => {
      emotionSystem.setEmotion('focused', 100);
      emotionSystem.update(100);
      expect(emotionSystem.getActiveEmotion()).toBeNull();
    });

    it('should handle multiple update calls', () => {
      emotionSystem.setEmotion('thinking', 200);
      emotionSystem.update(50);
      emotionSystem.update(50);
      emotionSystem.update(50);
      expect(emotionSystem.getRemainingDuration()).toBe(50);
      expect(emotionSystem.getActiveEmotion()).toBe('thinking');
    });

    it('should return false for needsRedraw when no change', () => {
      emotionSystem.setEmotion('focused', 5000);
      emotionSystem.update(0);
      const result = emotionSystem.update(16);
      expect(result.needsRedraw).toBe(false);
    });

    it('should return needsRedraw=true when emotion expires', () => {
      emotionSystem.setEmotion('focused', 100);
      const result = emotionSystem.update(100);
      expect(result.needsRedraw).toBe(true);
    });

    it('should return needsRedraw=false on first update after set', () => {
      emotionSystem.setEmotion('focused');
      const result = emotionSystem.update(0);
      expect(result.needsRedraw).toBe(false);
    });
  });

  describe('getEmotionVisuals', () => {
    it('should return correct visual for focused emotion', () => {
      emotionSystem.setEmotion('focused');
      const visual = emotionSystem.getEmotionVisuals();
      expect(visual).not.toBeNull();
      expect(visual!.emoji).toBe('🎯');
      expect(visual!.bgColor).toBe(0x3B82F6);
      expect(visual!.bounceAmplitude).toBe(0);
    });

    it('should return correct visual for thinking emotion', () => {
      emotionSystem.setEmotion('thinking');
      const visual = emotionSystem.getEmotionVisuals();
      expect(visual!.emoji).toBe('🤔');
      expect(visual!.bgColor).toBe(0x8B5CF6);
      expect(visual!.bounceAmplitude).toBe(3);
    });

    it('should return correct visual for sleepy emotion', () => {
      emotionSystem.setEmotion('sleepy');
      const visual = emotionSystem.getEmotionVisuals();
      expect(visual!.emoji).toBe('😴');
      expect(visual!.bgColor).toBe(0x9CA3AF);
      expect(visual!.bounceAmplitude).toBe(2);
    });

    it('should return correct visual for happy emotion', () => {
      emotionSystem.setEmotion('happy');
      const visual = emotionSystem.getEmotionVisuals();
      expect(visual!.emoji).toBe('😊');
      expect(visual!.bgColor).toBe(0x10B981);
      expect(visual!.bounceAmplitude).toBe(5);
    });

    it('should return correct visual for stressed emotion', () => {
      emotionSystem.setEmotion('stressed');
      const visual = emotionSystem.getEmotionVisuals();
      expect(visual!.emoji).toBe('😰');
      expect(visual!.bgColor).toBe(0xEF4444);
    });

    it('should return correct visual for celebrating emotion', () => {
      emotionSystem.setEmotion('celebrating');
      const visual = emotionSystem.getEmotionVisuals();
      expect(visual!.emoji).toBe('🎉');
      expect(visual!.bgColor).toBe(0xF59E0B);
      expect(visual!.bounceAmplitude).toBe(8);
    });

    it('should return null when no emotion is active', () => {
      const visual = emotionSystem.getEmotionVisuals();
      expect(visual).toBeNull();
    });
  });

  describe('getEmotionFromTask', () => {
    it('should return focused for coding tasks', () => {
      expect(emotionSystem.getEmotionFromTask('Implement login feature')).toBe('focused');
      expect(emotionSystem.getEmotionFromTask('Write unit tests')).toBe('focused');
      expect(emotionSystem.getEmotionFromTask('Fix bug in API')).toBe('focused');
    });

    it('should return thinking for analysis/review tasks', () => {
      expect(emotionSystem.getEmotionFromTask('Review PR changes')).toBe('thinking');
      expect(emotionSystem.getEmotionFromTask('Analyze requirements')).toBe('thinking');
      expect(emotionSystem.getEmotionFromTask('Design architecture')).toBe('thinking');
    });

    it('should return happy for completion tasks', () => {
      expect(emotionSystem.getEmotionFromTask('Finish documentation')).toBe('happy');
      expect(emotionSystem.getEmotionFromTask('Mark as done')).toBe('happy');
    });

    it('should return celebrating for success tasks', () => {
      expect(emotionSystem.getEmotionFromTask('All tests passed!')).toBe('celebrating');
      expect(emotionSystem.getEmotionFromTask('Successfully deployed')).toBe('celebrating');
      expect(emotionSystem.getEmotionFromTask('Complete deployment')).toBe('celebrating');
    });

    it('should return stressed for urgent tasks', () => {
      expect(emotionSystem.getEmotionFromTask('URGENT: Fix production bug')).toBe('stressed');
      expect(emotionSystem.getEmotionFromTask('Hotfix critical issue')).toBe('stressed');
    });

    it('should return sleepy for idle tasks', () => {
      expect(emotionSystem.getEmotionFromTask('Idle - no task')).toBe('sleepy');
    });

    it('should return thinking for review tasks', () => {
      expect(emotionSystem.getEmotionFromTask('Waiting for review')).toBe('thinking');
    });

    it('should return focused as default for unknown tasks', () => {
      expect(emotionSystem.getEmotionFromTask('Some random task')).toBe('focused');
    });

    it('should return focused for empty task', () => {
      expect(emotionSystem.getEmotionFromTask('')).toBe('focused');
    });
  });

  describe('getEmotionFromStatus', () => {
    it('should return sleepy for idle status', () => {
      expect(emotionSystem.getEmotionFromStatus('idle')).toBe('sleepy');
    });

    it('should return focused for busy status', () => {
      expect(emotionSystem.getEmotionFromStatus('busy')).toBe('focused');
    });

    it('should return null for offline status', () => {
      expect(emotionSystem.getEmotionFromStatus('offline')).toBeNull();
    });

    it('should return null for unknown status', () => {
      expect(emotionSystem.getEmotionFromStatus('unknown' as any)).toBeNull();
    });
  });

  describe('getBubbleConfig', () => {
    it('should return bubble position relative to character', () => {
      emotionSystem.setEmotion('focused');
      const bubble = emotionSystem.getBubbleConfig(100, 200);
      expect(bubble).not.toBeNull();
      expect(bubble!.x).toBe(100);
      expect(bubble!.y).toBeLessThan(200);
    });

    it('should return null when no emotion is active', () => {
      const bubble = emotionSystem.getBubbleConfig(100, 200);
      expect(bubble).toBeNull();
    });

    it('should include animation properties', () => {
      emotionSystem.setEmotion('thinking');
      const bubble = emotionSystem.getBubbleConfig(100, 200);
      expect(bubble!.animation).toBeDefined();
      expect(bubble!.animation.bounceAmplitude).toBe(3);
    });
  });

  describe('queueEmotion', () => {
    it('should queue emotion to display after current one', () => {
      emotionSystem.setEmotion('focused', 100);
      emotionSystem.queueEmotion('happy', 200);

      emotionSystem.update(100);
      expect(emotionSystem.getActiveEmotion()).toBe('happy');
      expect(emotionSystem.getRemainingDuration()).toBe(200);
    });

    it('should replace previous queued emotion', () => {
      emotionSystem.setEmotion('focused', 100);
      emotionSystem.queueEmotion('happy', 200);
      emotionSystem.queueEmotion('celebrating', 300);

      emotionSystem.update(100);
      expect(emotionSystem.getActiveEmotion()).toBe('celebrating');
    });

    it('should start immediately if no active emotion', () => {
      emotionSystem.queueEmotion('happy', 200);
      expect(emotionSystem.getActiveEmotion()).toBe('happy');
    });
  });

  describe('emotion history', () => {
    it('should track emotion history', () => {
      emotionSystem.setEmotion('focused');
      emotionSystem.setEmotion('thinking');
      emotionSystem.setEmotion('happy');

      const history = emotionSystem.getHistory();
      expect(history).toHaveLength(3);
      expect(history[0].emotion).toBe('focused');
      expect(history[1].emotion).toBe('thinking');
      expect(history[2].emotion).toBe('happy');
    });

    it('should limit history to 20 entries', () => {
      for (let i = 0; i < 25; i++) {
        emotionSystem.setEmotion('focused');
        emotionSystem.clearEmotion();
      }

      const history = emotionSystem.getHistory();
      expect(history.length).toBeLessThanOrEqual(20);
    });

    it('should include timestamp in history', () => {
      emotionSystem.setEmotion('focused');
      const history = emotionSystem.getHistory();
      expect(history[0].timestamp).toBeGreaterThan(0);
    });
  });
});
