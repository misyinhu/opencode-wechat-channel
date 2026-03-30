import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export function getWechatTools(): Tool[] {
  return [
    {
      name: "wechat_reply",
      description: "Send a plain-text reply to the WeChat user (or group)",
      inputSchema: {
        type: "object",
        properties: {
          sender_id: {
            type: "string",
            description:
              "sender_id from the inbound tag (xxx@im.wechat). " +
              "In group chats use group_id instead.",
          },
          text: {
            type: "string",
            description: "Plain-text message (no markdown, no emoji unless asked)",
          },
        },
        required: ["sender_id", "text"],
      },
    },
    {
      name: "wechat_send_image",
      description: "Send a local image file to the WeChat user",
      inputSchema: {
        type: "object",
        properties: {
          sender_id: {
            type: "string",
            description: "Same as wechat_reply sender_id",
          },
          file_path: {
            type: "string",
            description: "Absolute path to the image file on disk (PNG, JPG, etc.)",
          },
        },
        required: ["sender_id", "file_path"],
      },
    },
  ];
}
