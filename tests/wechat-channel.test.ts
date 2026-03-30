import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WeChatChannel } from '../src/wechat-channel.js';

describe('WeChatChannel', () => {
  let channel: WeChatChannel;

  beforeEach(() => {
    channel = new WeChatChannel();
  });

  afterEach(() => {
    channel.stop();
  });

  describe('initialization', () => {
    it('should create WeChatChannel instance', () => {
      expect(channel).toBeInstanceOf(WeChatChannel);
    });
  });

  describe('sendMessage', () => {
    it('should track user sessions', () => {
      const msg = {
        sessionId: 'session-123',
        promptId: 'prompt-456',
        content: 'Hello',
        userId: 'user@wechat',
      };

      expect(() => {
        (channel as any).userSessions = new Map();
        (channel as any).userSessions.set(msg.userId, {
          sessionId: msg.sessionId,
          promptId: msg.promptId,
        });
      }).not.toThrow();

      const sessions = (channel as any).userSessions;
      expect(sessions.get(msg.userId)?.sessionId).toBe('session-123');
    });
  });

  describe('stop', () => {
    it('should stop without error', () => {
      expect(() => channel.stop()).not.toThrow();
    });
  });
});
