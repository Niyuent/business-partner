import { defineStore } from 'pinia';

export type AiChatMsg = { role: 'ai' | 'user'; text: string };

/** 商家 AI 面板会话：切底栏不丢消息 */
export const useAiChatStore = defineStore('ai-chat', {
  state: () => ({
    messages: [] as AiChatMsg[],
    seeded: false,
    statusHint: '准备中',
    storeName: '',
    sessionId: null as string | null,
    input: '',
    sending: false,
  }),
  actions: {
    push(role: 'ai' | 'user', text: string) {
      this.messages = [...this.messages, { role, text }];
    },
    seedWelcome(text: string) {
      this.messages = [{ role: 'ai', text }];
      this.seeded = true;
    },
    reset() {
      this.messages = [];
      this.seeded = false;
      this.statusHint = '准备中';
      this.storeName = '';
      this.sessionId = null;
      this.input = '';
      this.sending = false;
    },
  },
});
