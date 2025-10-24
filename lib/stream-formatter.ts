// stream-formatter.ts

export interface StreamEvent {
  type: string;
  id?: string;
  delta?: string;
}

export class StreamFormatter {
  private messageId: string;

  constructor(messageId: string) {
    this.messageId = messageId;
  }

  formatEvent(type: string, content?: string): string {
    const event: StreamEvent = {
      type,
      ...(this.messageId && { id: this.messageId }),
      ...(content && { delta: content })
    };
    return `data: ${JSON.stringify(event)}\n\n`;
  }

  *startStream() {
    yield this.formatEvent('start');
    yield this.formatEvent('start-step');
    yield this.formatEvent('text-start');
  }

  *endStream() {
    yield this.formatEvent('text-end');
    yield this.formatEvent('finish-step');
    yield this.formatEvent('finish');
    yield 'data: [DONE]\n\n';
  }

  *textDelta(content: string) {
    yield this.formatEvent('text-delta', content);
  }
}