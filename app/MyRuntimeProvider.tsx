// app/MyRuntimeProvider.tsx
"use client";

import { useEffect, useState, createContext, useContext } from "react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { OpenWebUIAdapter } from "@/lib/openwebui-adapter";

// Context for managing uploaded files
interface FileContextType {
  uploadedFileIds: string[];
  addFileId: (id: string) => void;
  clearFileIds: () => void;
}

const FileContext = createContext<FileContextType>({
  uploadedFileIds: [],
  addFileId: () => {},
  clearFileIds: () => {},
});

export const useFileContext = () => useContext(FileContext);

export function MyRuntimeProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [adapter, setAdapter] = useState<OpenWebUIAdapter | null>(null);
  const [uploadedFileIds, setUploadedFileIds] = useState<string[]>([]);

  useEffect(() => {
    const adapterInstance = new OpenWebUIAdapter("/api/chat");
    setAdapter(adapterInstance);
  }, []);

  const addFileId = (id: string) => {
    setUploadedFileIds(prev => {
      const newIds = [...prev, id];
      adapter?.addFileIds([id]);
      return newIds;
    });
  };

  const clearFileIds = () => {
    setUploadedFileIds([]);
    adapter?.clearFileIds();
  };

  if (!adapter) {
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
    <FileContext.Provider value={{ uploadedFileIds, addFileId, clearFileIds }}>
      <AssistantRuntimeProvider runtime={adapter}>
        {children}
      </AssistantRuntimeProvider>
    </FileContext.Provider>
  );
}