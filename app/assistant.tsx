// app/assistant.tsx - FINAL FIXED VERSION
"use client";

import { useState, useEffect } from "react";
import { AssistantRuntimeProvider, useLocalRuntime } from "@assistant-ui/react";
import { Thread } from "@/components/assistant-ui/thread";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ThreadListSidebar } from "@/components/assistant-ui/threadlist-sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { CompositeAttachmentAdapter } from "@assistant-ui/react";
import { PDFAttachmentAdapter, setGlobalChatAdapter } from "@/lib/pdf-adapter";
import { OpenWebUIAdapter } from "@/lib/openwebui-adapter";

export function Assistant() {
  const [adapter, setAdapter] = useState<OpenWebUIAdapter | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    console.log('🚀 Initializing Assistant...');
    
    // Create adapter instance
    const adapterInstance = new OpenWebUIAdapter("/api/chat");
    setAdapter(adapterInstance);
    
    // CRITICAL: Set global adapter so PDFAttachmentAdapter can access it
    setGlobalChatAdapter(adapterInstance);
    
    console.log('✅ Adapter initialized and set globally');
    setIsReady(true);
  }, []);

  // Create runtime with OpenWebUI adapter
  const runtime = useLocalRuntime(
    adapter || undefined,
    {
      adapters: {
        attachments: new CompositeAttachmentAdapter([
          new PDFAttachmentAdapter(),
        ])
      }
    }
  );

  if (!isReady || !adapter) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-gray-100 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading assistant...</p>
        </div>
      </div>
    );
  }

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <SidebarProvider>
        <div className="flex h-dvh w-full pr-0.5">
          <ThreadListSidebar />
          <SidebarInset>
            <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    Book Generation
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>LaTeX Generator</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </header>
            <div className="flex-1 overflow-hidden">
              <Thread />
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </AssistantRuntimeProvider>
  );
}

export default Assistant;