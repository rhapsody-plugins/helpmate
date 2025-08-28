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
import { EditorContent, type Extension, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

const extensions = [
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
];

const RichTextEditor = ({
  content,
  onChange,
  texts = [],
}: {
  content: string;
  onChange: (content: string) => void;
  texts?: string[];
}) => {
  const editor = useEditor({
    extensions: extensions as Extension[],
    content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  if (!editor) {
    return null;
  }

  return (
    <div className="relative w-full pb-3 overflow-hidden border rounded-md border-input">
      <div className="sticky top-0 left-0 z-20 flex items-center justify-between w-full px-2 py-2 border-b bg-background border-input">
        <ToolbarProvider editor={editor}>
          <div className="flex items-center gap-2">
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
            {texts.length > 0 && (
              <>
                <Separator orientation="vertical" className="h-7" />
                <TextInsertToolbar texts={texts} />
              </>
            )}
          </div>
        </ToolbarProvider>
      </div>
      <div
        onClick={() => {
          editor?.chain().focus().run();
        }}
        className="cursor-text min-h-[10rem] bg-background"
      >
        <EditorContent className="outline-none" editor={editor} />
      </div>
    </div>
  );
};

export default RichTextEditor;
