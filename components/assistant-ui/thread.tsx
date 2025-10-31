// components/assistant-ui/thread.tsx - With Enhanced LaTeX Viewer
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  PencilIcon,
  RefreshCwIcon,
  Square,
  FileCode2,
  Download,
  ExternalLink,
  Eye,
  Code,
} from "lucide-react";

import {
  ActionBarPrimitive,
  BranchPickerPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  type TextContentPartComponent,
} from "@assistant-ui/react";

import type { FC } from "react";
import { useState } from "react";
import { LazyMotion, MotionConfig, domAnimation } from "motion/react";
import * as m from "motion/react-m";

import { Button } from "@/components/ui/button";
import { MarkdownText } from "@/components/assistant-ui/markdown-text";
import { ToolFallback } from "@/components/assistant-ui/tool-fallback";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import {
  ComposerAddAttachment,
  ComposerAttachments,
  UserMessageAttachments,
} from "@/components/assistant-ui/attachment";

import { cn } from "@/lib/utils";

// ========================================
// LATEX UTILITIES
// ========================================

function extractLatexCode(text: string): string | null {
  // Match both ```latex and ```tex code blocks
  const latexMatch = text.match(/```(?:latex|tex)\n([\s\S]*?)```/);
  return latexMatch ? latexMatch[1] : null;
}

function createOverleafProject(latexCode: string) {
  try {
    // Create a proper Overleaf-compatible base64 encoded URL
    const encodedCode = btoa(unescape(encodeURIComponent(latexCode)));
    const overleafUrl = `https://www.overleaf.com/docs?snip_uri=data:application/x-latex;base64,${encodedCode}`;
    window.open(overleafUrl, '_blank', 'noopener,noreferrer');
  } catch (error) {
    console.error('Failed to create Overleaf project:', error);
    alert('Failed to open in Overleaf. Please try downloading the .tex file instead.');
  }
}

function downloadLatexFile(latexCode: string, filename: string = 'document.tex') {
  try {
    const blob = new Blob([latexCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to download file:', error);
    alert('Failed to download file.');
  }
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => {
    console.log('✅ Copied to clipboard');
  }).catch(err => {
    console.error('❌ Failed to copy:', err);
  });
}

// ========================================
// LATEX PREVIEW COMPONENT
// ========================================

const LaTeXPreview: FC<{ latexCode: string; fullText: string }> = ({ latexCode, fullText }) => {
  const [view, setView] = useState<'code' | 'preview'>('code');
  const [isCompiling, setIsCompiling] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCompileToPDF = async () => {
    setIsCompiling(true);
    try {
      const response = await fetch('/api/compile-latex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latexCode }),
      });

      if (!response.ok) {
        throw new Error('Compilation failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'document.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Compilation error:', error);
      alert('PDF compilation is not available. Download the .tex file and compile it locally or in Overleaf.');
    } finally {
      setIsCompiling(false);
    }
  };

  const handleCopy = () => {
    copyToClipboard(latexCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Split text before and after LaTeX code
  const textBeforeCode = fullText.split(/```(?:latex|tex)/)[0];
  const textAfterCode = fullText.split('```')[2] || '';

  return (
    <div className="my-4 space-y-4">
      {textBeforeCode.trim() && (
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <p className="text-foreground">{textBeforeCode.trim()}</p>
        </div>
      )}

      <div className="border rounded-lg overflow-hidden bg-muted/30 dark:bg-muted/10">
        {/* Toolbar */}
        <div className="bg-muted/50 dark:bg-muted/30 border-b px-4 py-2.5 flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <FileCode2 className="h-4 w-4" />
            <span>LaTeX Document</span>
          </div>
          
          <div className="flex-1" />
          
          {/* View Toggle */}
          <div className="flex gap-0.5 border rounded-md p-0.5 bg-background">
            <button
              onClick={() => setView('code')}
              className={cn(
                "px-3 py-1 text-xs rounded flex items-center gap-1.5 transition-colors",
                view === 'code' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'hover:bg-muted'
              )}
            >
              <Code className="h-3 w-3" />
              Code
            </button>
            <button
              onClick={() => setView('preview')}
              className={cn(
                "px-3 py-1 text-xs rounded flex items-center gap-1.5 transition-colors",
                view === 'preview' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'hover:bg-muted'
              )}
            >
              <Eye className="h-3 w-3" />
              Preview
            </button>
          </div>

          {/* Action Buttons */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopy}
            className="h-7 text-xs"
          >
            {copied ? <CheckIcon className="h-3 w-3 mr-1" /> : <CopyIcon className="h-3 w-3 mr-1" />}
            {copied ? 'Copied!' : 'Copy'}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => downloadLatexFile(latexCode)}
            className="h-7 text-xs"
          >
            <Download className="h-3 w-3 mr-1" />
            .tex
          </Button>
          
          <Button
            size="sm"
            variant="outline"
            onClick={() => createOverleafProject(latexCode)}
            className="h-7 text-xs bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700"
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Overleaf
          </Button>

          <Button
            size="sm"
            variant="default"
            onClick={handleCompileToPDF}
            disabled={isCompiling}
            className="h-7 text-xs"
          >
            {isCompiling ? (
              <>
                <RefreshCwIcon className="h-3 w-3 mr-1 animate-spin" />
                Compiling...
              </>
            ) : (
              <>
                <Download className="h-3 w-3 mr-1" />
                PDF
              </>
            )}
          </Button>
        </div>

        {/* Content */}
        <div className="max-h-[32rem] overflow-auto">
          {view === 'code' ? (
            <pre className="p-4 text-xs leading-relaxed font-mono text-foreground">
              <code className="language-latex">{latexCode}</code>
            </pre>
          ) : (
            <div className="p-4 prose prose-sm max-w-none dark:prose-invert">
              <p className="text-muted-foreground italic text-sm mb-3">
                This is a simplified preview. For full LaTeX rendering with proper formatting, 
                download the .tex file or open it in Overleaf.
              </p>
              <div className="mt-4 p-4 bg-background rounded border text-xs font-mono whitespace-pre-wrap break-words">
                {latexCode.length > 1000 ? (
                  <>
                    {latexCode.substring(0, 1000)}
                    <span className="text-muted-foreground">... (truncated, see Code view for full content)</span>
                  </>
                ) : latexCode}
              </div>
            </div>
          )}
        </div>
      </div>

      {textAfterCode.trim() && (
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <p className="text-foreground">{textAfterCode.trim()}</p>
        </div>
      )}
    </div>
  );
};

// ========================================
// CUSTOM TEXT RENDERER WITH LATEX DETECTION
// ========================================

const CustomTextRenderer: TextContentPartComponent = (props) => {
  // Extract text content
  const text = props.part?.text || '';
  
  // Check for LaTeX code blocks
  const latexCode = extractLatexCode(text);

  if (latexCode) {
    return <LaTeXPreview latexCode={latexCode} fullText={text} />;
  }

  // Default: render with MarkdownText
  return <MarkdownText {...props} />;
};

// ========================================
// MAIN THREAD COMPONENT (rest remains same)
// ========================================

export const Thread: FC = () => {
  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user">
        <ThreadPrimitive.Root
          className="aui-root aui-thread-root @container flex h-full flex-col bg-background"
          style={{
            ["--thread-max-width" as string]: "44rem",
          }}
        >
          <ThreadPrimitive.Viewport className="aui-thread-viewport relative flex flex-1 flex-col overflow-x-auto overflow-y-scroll px-4">
            <ThreadPrimitive.If empty>
              <ThreadWelcome />
            </ThreadPrimitive.If>

            <ThreadPrimitive.Messages
              components={{
                UserMessage,
                EditComposer,
                AssistantMessage,
              }}
            />

            <ThreadPrimitive.If empty={false}>
              <div className="aui-thread-viewport-spacer min-h-8 grow" />
            </ThreadPrimitive.If>

            <Composer />
          </ThreadPrimitive.Viewport>
        </ThreadPrimitive.Root>
      </MotionConfig>
    </LazyMotion>
  );
};

const ThreadScrollToBottom: FC = () => {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <TooltipIconButton
        tooltip="Scroll to bottom"
        variant="outline"
        className="aui-thread-scroll-to-bottom absolute -top-12 z-10 self-center rounded-full p-4 disabled:invisible dark:bg-background dark:hover:bg-accent"
      >
        <ArrowDownIcon />
      </TooltipIconButton>
    </ThreadPrimitive.ScrollToBottom>
  );
};

// ========================================
// THREAD WELCOME
// ========================================

const ThreadWelcome: FC = () => {
  return (
    <div className="aui-thread-welcome-root mx-auto my-auto flex w-full max-w-[var(--thread-max-width)] flex-grow flex-col">
      <div className="aui-thread-welcome-center flex w-full flex-grow flex-col items-center justify-center">
        <div className="aui-thread-welcome-message flex size-full flex-col justify-center px-8">
          <m.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="aui-thread-welcome-message-motion-1 text-2xl font-semibold"
          >
            📚 LaTeX Book Generator
          </m.div>
          <m.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ delay: 0.1 }}
            className="aui-thread-welcome-message-motion-2 text-2xl text-muted-foreground/65"
          >
            Upload PDFs and generate professional LaTeX chapters
          </m.div>
        </div>
      </div>
      <ThreadSuggestions />
    </div>
  );
};

const ThreadSuggestions: FC = () => {
  return (
    <div className="aui-thread-welcome-suggestions grid w-full gap-2 pb-4 @md:grid-cols-2">
      {[
        {
          title: "Generate chapter",
          label: "from uploaded documents",
          action: "Generate a book chapter in LaTeX format from the uploaded documents",
        },
        {
          title: "Create introduction",
          label: "with proper structure",
          action: "Create an introduction chapter in LaTeX with sections for background, motivation, and objectives",
        },
        {
          title: "Format bibliography",
          label: "from references",
          action: "Extract references from the documents and create a LaTeX bibliography section",
        },
        {
          title: "Complete document",
          label: "with TOC and chapters",
          action: "Create a complete LaTeX book document with table of contents and multiple chapters",
        },
      ].map((suggestedAction, index) => (
        <m.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ delay: 0.05 * index }}
          key={`suggested-action-${index}`}
          className="aui-thread-welcome-suggestion-display [&:nth-child(n+3)]:hidden @md:[&:nth-child(n+3)]:block"
        >
          <ThreadPrimitive.Suggestion
            prompt={suggestedAction.action}
            method="replace"
            autoSend
            asChild
          >
            <Button
              variant="ghost"
              className="aui-thread-welcome-suggestion h-auto w-full flex-1 flex-wrap items-start justify-start gap-1 rounded-3xl border px-5 py-4 text-left text-sm @md:flex-col dark:hover:bg-accent/60"
              aria-label={suggestedAction.action}
            >
              <span className="aui-thread-welcome-suggestion-text-1 font-medium">
                {suggestedAction.title}
              </span>
              <span className="aui-thread-welcome-suggestion-text-2 text-muted-foreground">
                {suggestedAction.label}
              </span>
            </Button>
          </ThreadPrimitive.Suggestion>
        </m.div>
      ))}
    </div>
  );
};

const Composer: FC = () => {
  return (
    <div className="aui-composer-wrapper sticky bottom-0 mx-auto flex w-full max-w-[var(--thread-max-width)] flex-col gap-4 overflow-visible rounded-t-3xl bg-background pb-4 md:pb-6">
      <ThreadScrollToBottom />
      <ComposerPrimitive.Root className="aui-composer-root relative flex w-full flex-col rounded-3xl border border-border bg-muted px-1 pt-2 shadow-[0_9px_9px_0px_rgba(0,0,0,0.01),0_2px_5px_0px_rgba(0,0,0,0.06)] dark:border-muted-foreground/15">
        <ComposerAttachments />
        <ComposerPrimitive.Input
          placeholder="Upload documents and describe what you want to generate..."
          className="aui-composer-input mb-1 max-h-32 min-h-16 w-full resize-none bg-transparent px-3.5 pt-1.5 pb-3 text-base outline-none placeholder:text-muted-foreground focus:outline-primary"
          rows={1}
          autoFocus
          aria-label="Message input"
        />
        <ComposerAction />
      </ComposerPrimitive.Root>
    </div>
  );
};

const ComposerAction: FC = () => {
  return (
    <div className="aui-composer-action-wrapper relative mx-1 mt-2 mb-2 flex items-center justify-between">
      <ComposerAddAttachment />

      <ThreadPrimitive.If running={false}>
        <ComposerPrimitive.Send asChild>
          <TooltipIconButton
            tooltip="Send message"
            side="bottom"
            type="submit"
            variant="default"
            size="icon"
            className="aui-composer-send size-[34px] rounded-full p-1"
            aria-label="Send message"
          >
            <ArrowUpIcon className="aui-composer-send-icon size-5" />
          </TooltipIconButton>
        </ComposerPrimitive.Send>
      </ThreadPrimitive.If>

      <ThreadPrimitive.If running>
        <ComposerPrimitive.Cancel asChild>
          <Button
            type="button"
            variant="default"
            size="icon"
            className="aui-composer-cancel size-[34px] rounded-full border border-muted-foreground/60 hover:bg-primary/75 dark:border-muted-foreground/90"
            aria-label="Stop generating"
          >
            <Square className="aui-composer-cancel-icon size-3.5 fill-white dark:fill-black" />
          </Button>
        </ComposerPrimitive.Cancel>
      </ThreadPrimitive.If>
    </div>
  );
};

const MessageError: FC = () => {
  return (
    <MessagePrimitive.Error>
      <ErrorPrimitive.Root className="aui-message-error-root mt-2 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive dark:bg-destructive/5 dark:text-red-200">
        <ErrorPrimitive.Message className="aui-message-error-message line-clamp-2" />
      </ErrorPrimitive.Root>
    </MessagePrimitive.Error>
  );
};

const AssistantMessage: FC = () => {
  return (
    <MessagePrimitive.Root asChild>
      <div
        className="aui-assistant-message-root relative mx-auto w-full max-w-[var(--thread-max-width)] animate-in py-4 duration-150 ease-out fade-in slide-in-from-bottom-1 last:mb-24"
        data-role="assistant"
      >
        <div className="aui-assistant-message-content mx-2 leading-7 break-words text-foreground">
          <MessagePrimitive.Parts
            components={{
              Text: CustomTextRenderer,
              tools: { Fallback: ToolFallback },
            }}
          />
          <MessageError />
        </div>

        <div className="aui-assistant-message-footer mt-2 ml-2 flex">
          <BranchPicker />
          <AssistantActionBar />
        </div>
      </div>
    </MessagePrimitive.Root>
  );
};

const AssistantActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      autohideFloat="single-branch"
      className="aui-assistant-action-bar-root col-start-3 row-start-2 -ml-1 flex gap-1 text-muted-foreground data-[floating]:absolute data-[floating]:rounded-md data-[floating]:border data-[floating]:bg-background data-[floating]:p-1 data-[floating]:shadow-sm"
    >
      <ActionBarPrimitive.Copy asChild>
        <TooltipIconButton tooltip="Copy">
          <MessagePrimitive.If copied>
            <CheckIcon />
          </MessagePrimitive.If>
          <MessagePrimitive.If copied={false}>
            <CopyIcon />
          </MessagePrimitive.If>
        </TooltipIconButton>
      </ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Reload asChild>
        <TooltipIconButton tooltip="Refresh">
          <RefreshCwIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Reload>
    </ActionBarPrimitive.Root>
  );
};

const UserMessage: FC = () => {
  return (
    <MessagePrimitive.Root asChild>
      <div
        className="aui-user-message-root mx-auto grid w-full max-w-[var(--thread-max-width)] animate-in auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] gap-y-2 px-2 py-4 duration-150 ease-out fade-in slide-in-from-bottom-1 first:mt-3 last:mb-5 [&:where(>*)]:col-start-2"
        data-role="user"
      >
        <UserMessageAttachments />

        <div className="aui-user-message-content-wrapper relative col-start-2 min-w-0">
          <div className="aui-user-message-content rounded-3xl bg-muted px-5 py-2.5 break-words text-foreground">
            <MessagePrimitive.Parts />
          </div>
          <div className="aui-user-action-bar-wrapper absolute top-1/2 left-0 -translate-x-full -translate-y-1/2 pr-2">
            <UserActionBar />
          </div>
        </div>

        <BranchPicker className="aui-user-branch-picker col-span-full col-start-1 row-start-3 -mr-1 justify-end" />
      </div>
    </MessagePrimitive.Root>
  );
};

const UserActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="aui-user-action-bar-root flex flex-col items-end"
    >
      <ActionBarPrimitive.Edit asChild>
        <TooltipIconButton tooltip="Edit" className="aui-user-action-edit p-4">
          <PencilIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Edit>
    </ActionBarPrimitive.Root>
  );
};

const EditComposer: FC = () => {
  return (
    <div className="aui-edit-composer-wrapper mx-auto flex w-full max-w-[var(--thread-max-width)] flex-col gap-4 px-2 first:mt-4">
      <ComposerPrimitive.Root className="aui-edit-composer-root ml-auto flex w-full max-w-7/8 flex-col rounded-xl bg-muted">
        <ComposerPrimitive.Input
          className="aui-edit-composer-input flex min-h-[60px] w-full resize-none bg-transparent p-4 text-foreground outline-none"
          autoFocus
        />

        <div className="aui-edit-composer-footer mx-3 mb-3 flex items-center justify-center gap-2 self-end">
          <ComposerPrimitive.Cancel asChild>
            <Button variant="ghost" size="sm" aria-label="Cancel edit">
              Cancel
            </Button>
          </ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send asChild>
            <Button size="sm" aria-label="Update message">
              Update
            </Button>
          </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
    </div>
  );
};

const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = ({
  className,
  ...rest
}) => {
  return (
    <BranchPickerPrimitive.Root
      hideWhenSingleBranch
      className={cn(
        "aui-branch-picker-root mr-2 -ml-2 inline-flex items-center text-xs text-muted-foreground",
        className,
      )}
      {...rest}
    >
      <BranchPickerPrimitive.Previous asChild>
        <TooltipIconButton tooltip="Previous">
          <ChevronLeftIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Previous>
      <span className="aui-branch-picker-state font-medium">
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next asChild>
        <TooltipIconButton tooltip="Next">
          <ChevronRightIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  );
};