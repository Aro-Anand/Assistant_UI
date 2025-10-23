// page.tsx
'use client';

import { AssistantRuntimeProvider } from '@assistant-ui/react';
import { useChatRuntime } from '@assistant-ui/react-ai-sdk';
import { Thread } from '@/components/assistant-ui/thread';

export default function Home() {
  // Use useChatRuntime directly - it handles everything internally
  const runtime = useChatRuntime({
    api: '/api/chat',
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="h-screen">
        <Thread />
      </div>
    </AssistantRuntimeProvider>
  );
}