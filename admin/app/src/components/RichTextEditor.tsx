'use client';

import { Separator } from '@/components/ui/separator';
import { BlockquoteToolbar } from '@/components/toolbars/blockquote';
import { BoldToolbar } from '@/components/toolbars/bold';
import { BulletListToolbar } from '@/components/toolbars/bullet-list';
import { CodeToolbar } from '@/components/toolbars/code';
import { CodeBlockToolbar } from '@/components/toolbars/code-block';
import { HardBreakToolbar } from '@/components/toolbars/hard-break';
import { HorizontalRuleToolbar } from '@/components/toolbars/horizontal-rule';
import { ItalicToolbar } from '@/components/toolbars/italic';
import { OrderedListToolbar } from '@/components/toolbars/ordered-list';
import { RedoToolbar } from '@/components/toolbars/redo';
import { StrikeThroughToolbar } from '@/components/toolbars/strikethrough';
import { TextInsertToolbar } from '@/components/toolbars/text-insert';
import { ToolbarProvider } from '@/components/toolbars/toolbar-provider';
import { UndoToolbar } from '@/components/toolbars/undo';
import { ImageToolbar } from '@/components/toolbars/image';
import { CodeViewToolbar } from '@/components/toolbars/code-view';
import { EditorContent, type Extension, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import Image from '@tiptap/extension-image';
import { useEffect, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';

const getExtensions = (useMarkdown: boolean) => [
  StarterKit.configure({
    orderedList: {
      HTMLAttributes: {
        class: 'list-decimal',
      },
    },
    bulletList: {
      HTMLAttributes: {
        class: 'list-disc',
      },
    },
    code: {
      HTMLAttributes: {
        class: 'bg-accent rounded-md p-1',
      },
    },
    horizontalRule: {
      HTMLAttributes: {
        class: 'my-2',
      },
    },
    codeBlock: {
      HTMLAttributes: {
        class: 'bg-primary text-primary-foreground p-2 text-sm rounded-md p-1',
      },
    },
    heading: {
      levels: [1, 2, 3, 4],
      HTMLAttributes: {
        class: 'tiptap-heading',
      },
    },
  }),
  Image.configure({
    inline: true,
    allowBase64: true,
  }),
  ...(useMarkdown ? [Markdown] : []),
];

interface VariableGroup {
  label: string;
  variables: string[];
}

const RichTextEditor = ({
  content,
  onChange,
  texts = [],
  groupedVariables,
  useMarkdown = false,
}: {
  content: string;
  onChange: (content: string) => void;
  texts?: string[];
  groupedVariables?: VariableGroup[];
  useMarkdown?: boolean;
}) => {
  const [isCodeView, setIsCodeView] = useState(false);
  const [codeContent, setCodeContent] = useState(content);

  const editor = useEditor({
    extensions: getExtensions(useMarkdown) as Extension[],
    content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      if (useMarkdown) {
        const newContent = editor.storage.markdown.getMarkdown();
        onChange(newContent);
        setCodeContent(newContent);
      } else {
        const newContent = editor.getHTML();
        onChange(newContent);
        setCodeContent(newContent);
      }
    },
  });

  // Update editor content when content prop changes
  useEffect(() => {
    if (editor && content !== undefined && !isCodeView) {
      const currentContent = useMarkdown
        ? editor.storage.markdown?.getMarkdown()
        : editor.getHTML();

      // Only update if content actually changed to avoid infinite loops
      if (currentContent !== content) {
        editor.commands.setContent(content, false);
      }
    }
  }, [content, editor, useMarkdown, isCodeView]);

  // Sync code content when switching views
  useEffect(() => {
    if (isCodeView) {
      setCodeContent(content);
    }
  }, [isCodeView, content]);

  const handleCodeViewToggle = () => {
    if (isCodeView) {
      // Switching from code view to visual view
      if (editor) {
        editor.commands.setContent(codeContent, false);
        onChange(codeContent);
      }
    }
    setIsCodeView(!isCodeView);
  };

  const handleCodeChange = (value: string) => {
    setCodeContent(value);
    onChange(value);
  };

  if (!editor) {
    return null;
  }

  return (
    <div className="overflow-hidden relative pb-3 w-full rounded-md border border-input">
        <div className="flex sticky top-0 left-0 z-20 justify-between items-center px-2 py-2 w-full border-b bg-background border-input">
          <ToolbarProvider editor={editor}>
            <div className="flex flex-1 gap-2 items-center">
              <UndoToolbar />
              <RedoToolbar />
              <Separator orientation="vertical" className="h-7" />
              <BoldToolbar />
              <ItalicToolbar />
              <StrikeThroughToolbar />
              <BulletListToolbar />
              <OrderedListToolbar />
              <CodeToolbar />
              <CodeBlockToolbar />
              <HorizontalRuleToolbar />
              <BlockquoteToolbar />
              <HardBreakToolbar />
              <ImageToolbar />
              <Separator orientation="vertical" className="h-7" />
              <CodeViewToolbar isCodeView={isCodeView} onToggle={handleCodeViewToggle} />
            </div>
            {(texts.length > 0 || (groupedVariables && groupedVariables.length > 0)) && (
              <div className="flex gap-2 items-center ml-auto">
                <Separator orientation="vertical" className="h-7" />
                <TextInsertToolbar texts={texts} grouped={groupedVariables} />
              </div>
            )}
          </ToolbarProvider>
        </div>
      {isCodeView ? (
        <Textarea
          value={codeContent}
          onChange={(e) => handleCodeChange(e.target.value)}
          className="min-h-[10rem] font-mono text-sm resize-none border-0 rounded-none"
          placeholder="Enter HTML code..."
        />
      ) : (
        <div
          onClick={() => {
            editor?.chain().focus().run();
          }}
          className="cursor-text min-h-[10rem] bg-background"
        >
          <EditorContent className="outline-none" editor={editor} />
        </div>
      )}
    </div>
  );
};

export default RichTextEditor;
