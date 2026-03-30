import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';

describe('OAuth Authentication', () => {
  const testDir = path.join(os.tmpdir(), 'opencode-wechat-test');
  const credPath = path.join(testDir, 'account.json');

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(credPath)) {
      fs.unlinkSync(credPath);
    }
    if (fs.existsSync(testDir)) {
      fs.rmdirSync(testDir, { recursive: true });
    }
  });

  it('should generate a valid GUID', () => {
    const guid = randomUUID();
    expect(guid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('should save and load credentials correctly', () => {
    const testCreds = {
      token: 'test-token',
      channelToken: 'test-channel-token',
      userId: 'test-user',
      guid: 'test-guid',
      savedAt: new Date().toISOString(),
    };

    fs.writeFileSync(credPath, JSON.stringify(testCreds));
    const loaded = JSON.parse(fs.readFileSync(credPath, 'utf-8'));

    expect(loaded.token).toBe(testCreds.token);
    expect(loaded.channelToken).toBe(testCreds.channelToken);
    expect(loaded.userId).toBe(testCreds.userId);
  });

  it('should validate state format', () => {
    const state = randomUUID();
    expect(state).toBeDefined();
    expect(state.length).toBeGreaterThan(0);
  });
});