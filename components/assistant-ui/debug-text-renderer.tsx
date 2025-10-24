// components/assistant-ui/debug-text-renderer.tsx
// USE THIS TEMPORARILY to see what data structure you're receiving

import { type FC } from "react";
import { type TextContentPartComponent } from "@assistant-ui/react";
import { MarkdownText } from "@/components/assistant-ui/markdown-text";

export const DebugTextRenderer: TextContentPartComponent = (props) => {
  // Log EVERYTHING
  console.group('🔍 DEBUG: TextContentPartComponent Props');
  console.log('Full props:', props);
  console.log('props.part:', props.part);
  console.log('props.part.text:', props.part?.text);
  console.log('props.part.content:', (props.part as any)?.content);
  console.log('props.text:', (props as any).text);
  console.log('props.content:', (props as any).content);
  console.log('props.children:', (props as any).children);
  console.groupEnd();

  // Try all possible text locations
  const possibleTexts = [
    props.part?.text,
    (props.part as any)?.content,
    (props as any).text,
    (props as any).content,
    typeof (props as any).children === 'string' ? (props as any).children : null,
  ].filter(Boolean);

  const text = possibleTexts[0] || '';

  // Show debug info in UI (temporarily)
  return (
    <div>
      <div className="mb-2 p-2 bg-yellow-100 dark:bg-yellow-900/20 text-xs border rounded">
        <strong>Debug Info:</strong>
        <pre className="mt-1 overflow-auto text-[10px]">
          {JSON.stringify({
            hasPartText: !!props.part?.text,
            textLength: text.length,
            textPreview: text.substring(0, 100),
            propsKeys: Object.keys(props),
            partKeys: props.part ? Object.keys(props.part) : [],
          }, null, 2)}
        </pre>
      </div>
      <MarkdownText {...props} />
    </div>
  );
};

// USAGE in thread.tsx:
// import { DebugTextRenderer } from "@/components/assistant-ui/debug-text-renderer";
//
// <MessagePrimitive.Parts
//   components={{
//     Text: DebugTextRenderer,  // Use this temporarily
//     tools: { Fallback: ToolFallback },
//   }}
// />