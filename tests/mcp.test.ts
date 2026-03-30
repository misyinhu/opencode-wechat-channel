import { describe, it, expect, beforeEach } from 'vitest';
import { WeChatAGPClient } from '../src/websocket/client.js';

describe('WeChat AGP Client', () => {
  let client: WeChatAGPClient;

  beforeEach(() => {
    client = new WeChatAGPClient({
      channelToken: 'test-token',
      guid: 'test-guid',
      userId: 'test-user',
      onMessage: () => {},
    });
  });

  it('should create a new client instance', () => {
    expect(client).toBeInstanceOf(WeChatAGPClient);
    expect(client.getState()).toBe('disconnected');
  });

  it('should handle connection state', () => {
    expect(['disconnected', 'connecting', 'connected']).toContain(client.getState());
  });

  it('should stop cleanly', () => {
    expect(() => client.stop()).not.toThrow();
  });
});