import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WeChatAGPClient } from '../src/websocket/client.js';

describe('WeChatAGPClient', () => {
  let client: WeChatAGPClient;

  beforeEach(() => {
    client = new WeChatAGPClient({
      channelToken: 'test-token',
      guid: 'test-guid',
      userId: 'test-user',
      onMessage: () => {},
    });
  });

  afterEach(() => {
    client.stop();
  });

  describe('sendTextResponse', () => {
    it('should have sendTextResponse method', () => {
      expect(typeof client.sendTextResponse).toBe('function');
    });

    it('should not throw when sending text response', () => {
      expect(() => {
        client.sendTextResponse('session-123', 'prompt-456', 'Hello World');
      }).not.toThrow();
    });
  });

  describe('sendMessageChunk', () => {
    it('should have sendMessageChunk method', () => {
      expect(typeof client.sendMessageChunk).toBe('function');
    });

    it('should not throw when sending message chunk', () => {
      expect(() => {
        client.sendMessageChunk('session-123', 'prompt-456', 'Chunk ');
      }).not.toThrow();
    });
  });

  describe('getState', () => {
    it('should return initial state as disconnected', () => {
      expect(client.getState()).toBe('disconnected');
    });
  });

  describe('reconnection', () => {
    it('should have maxReconnectAttempts property', () => {
      expect((client as any).maxReconnectAttempts).toBe(5);
    });

    it('should have reconnectDelay property', () => {
      expect((client as any).reconnectDelay).toBe(3000);
    });
  });
});
