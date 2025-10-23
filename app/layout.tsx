'use client';

import { AssistantRuntimeProvider } from '@assistant-ui/react';
import { useChat } from '@ai-sdk/react';
import { useAISDKRuntime } from '@assistant-ui/react-ai-sdk';
import { createAttachmentAdapter } from '@/lib/attachment-adapter';
import '@assistant-ui/styles/index.css';
import '@assistant-ui/styles/markdown.css';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <MyRuntimeProvider>
          {children}
        </MyRuntimeProvider>
      </body>
    </html>
  );
}

function MyRuntimeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const chat = useChat({
    api: '/api/chat',
  });

  const runtime = useAISDKRuntime(chat, {
    adapters: {
      attachments: createAttachmentAdapter(),
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}