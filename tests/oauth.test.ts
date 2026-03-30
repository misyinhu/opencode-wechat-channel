import { describe, it, expect, vi } from 'vitest';
import {
  fetchQRCode,
  pollQRCodeStatus,
  WechatCredentials,
  saveCredentials,
  loadCredentials,
  isLoggedIn,
  clearCredentials,
} from '../src/auth/oauth.js';

describe('OAuth Module', () => {
  describe('fetchQRCode', () => {
    it('should call correct ilink API endpoint', async () => {
      const mockResponse = {
        qrcode: 'test-qrcode-value',
        qrcode_img_content: 'https://example.com/qr.png',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await fetchQRCode('https://ilinkai.weixin.qq.com');

      expect(fetch).toHaveBeenCalledWith(
        'https://ilinkai.weixin.qq.com/ilink/bot/get_bot_qrcode?bot_type=3'
      );
      expect(result.qrcode).toBe('test-qrcode-value');
      expect(result.qrcode_img_content).toBe('https://example.com/qr.png');
    });

    it('should throw error when API returns non-ok', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(fetchQRCode()).rejects.toThrow('QR fetch failed: 500');
    });
  });

  describe('pollQRCodeStatus', () => {
    it('should call correct status API endpoint', async () => {
      const mockResponse = {
        status: 'wait',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await pollQRCodeStatus(
        'https://ilinkai.weixin.qq.com',
        'test-qrcode'
      );

      expect(fetch).toHaveBeenCalledWith(
        'https://ilinkai.weixin.qq.com/ilink/bot/get_qrcode_status?qrcode=test-qrcode',
        expect.objectContaining({
          headers: { 'iLink-App-ClientVersion': '1' },
        })
      );
      expect(result.status).toBe('wait');
    });

    it('should return confirmed status with credentials when scan successful', async () => {
      const mockResponse = {
        status: 'confirmed',
        bot_token: 'test-token-123',
        ilink_bot_id: 'bot-12345',
        baseurl: 'https://ilinkai.weixin.qq.com',
        ilink_user_id: 'user-67890',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await pollQRCodeStatus(
        'https://ilinkai.weixin.qq.com',
        'test-qrcode',
        5000
      );

      expect(result.status).toBe('confirmed');
      expect(result.bot_token).toBe('test-token-123');
      expect(result.ilink_bot_id).toBe('bot-12345');
    });

    it('should return expired status when QR code expires', async () => {
      const mockResponse = {
        status: 'expired',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await pollQRCodeStatus(
        'https://ilinkai.weixin.qq.com',
        'test-qrcode'
      );

      expect(result.status).toBe('expired');
    });
  });
});
