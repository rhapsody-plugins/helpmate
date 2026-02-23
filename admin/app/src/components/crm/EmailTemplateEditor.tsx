'use client';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Bold,
  Code2,
  ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  SeparatorHorizontal,
  Strikethrough,
  TextQuote,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface VariableGroup {
  label: string;
  variables: string[];
}

interface BlockSnippet {
  id: string;
  label: string;
  html: string;
}

const EMAIL_BLOCK_SNIPPETS: BlockSnippet[] = [
  { id: 'greeting', label: 'Greeting', html: '<p style="margin:0 0 16px;">Hello {first_name},</p>' },
  { id: 'paragraph', label: 'Paragraph', html: '<p style="margin:0 0 16px;">Your message here. Use {name}, {email}.</p>' },
  { id: 'heading1', label: 'Heading 1', html: '<h1 style="margin:0 0 12px;font-size:24px;">Heading 1</h1>' },
  { id: 'heading2', label: 'Heading 2', html: '<h2 style="margin:0 0 12px;font-size:20px;color:#455CFE;">Heading 2</h2>' },
  { id: 'heading3', label: 'Heading 3', html: '<h3 style="margin:0 0 12px;font-size:17px;">Heading 3</h3>' },
  { id: 'cta', label: 'CTA Button', html: '<p style="text-align:center;margin:20px 0;"><a href="#" style="display:inline-block;background:#455CFE;color:white;padding:14px 28px;text-decoration:none;border-radius:8px;">Button Text</a></p>' },
  { id: 'divider', label: 'Divider', html: '<hr style="border:none;border-top:1px solid #eee;margin:24px 0;">' },
  { id: 'signature', label: 'Signature', html: '<p style="margin:24px 0 0;">Best regards,<br>{shop_name}</p>' },
];

function escapeHtmlAttr(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

interface EmailTemplateEditorProps {
  content: string;
  onChange: (value: string) => void;
  groupedVariables?: VariableGroup[];
}

function createPreviewDoc(bodyHtml: string, contentEditable: boolean): string {
  const bodyAttr = contentEditable ? ' contenteditable="true"' : '';
  return `<!DOCTYPE html><html style="height:100%"><head><style>html,body{height:100%;margin:0;padding:0;overflow:auto}body{display:flex;justify-content:center;align-items:flex-start;font-family:Arial,sans-serif;min-height:100%}</style></head><body${bodyAttr}>${bodyHtml}</body></html>`;
}

export default function EmailTemplateEditor({
  content,
  onChange,
  groupedVariables = [],
}: EmailTemplateEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastCursorRef = useRef<{ start: number; end: number } | null>(null);
  const lastPreviewHtmlRef = useRef<string | null>(null);
  const previewSelectionRef = useRef<{ doc: Document; range: Range } | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [variableSelectValue, setVariableSelectValue] = useState('');
  const [blockSelectValue, setBlockSelectValue] = useState('');
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [isDesktop, setIsDesktop] = useState(true);
  const [showHtmlEditor, setShowHtmlEditor] = useState(false);
  const [previewSrcDoc, setPreviewSrcDoc] = useState(() =>
    createPreviewDoc(content, true)
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    setIsDesktop(mq.matches);
    const handler = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const getInsertPosition = useCallback(() => {
    if (textareaRef.current && document.activeElement === textareaRef.current) {
      return {
        start: textareaRef.current.selectionStart,
        end: textareaRef.current.selectionEnd,
      };
    }
    if (lastCursorRef.current) {
      return lastCursorRef.current;
    }
    return { start: content.length, end: content.length };
  }, [content.length]);

  const insertIntoPreview = useCallback(
    (toInsert: string) => {
      const iframe = iframeRef.current;
      const doc = iframe?.contentDocument;
      if (!doc) return;

      const body = doc.body;
      const sel = previewSelectionRef.current;

      if (sel && sel.doc === doc) {
        try {
          sel.range.deleteContents();
          const fragment = doc.createRange().createContextualFragment(toInsert);
          sel.range.insertNode(fragment);
          sel.range.collapse(false);
        } catch {
          body.innerHTML += toInsert;
        }
      } else {
        body.innerHTML += toInsert;
      }

      const newHtml = body.innerHTML;
      lastPreviewHtmlRef.current = newHtml;
      onChange(newHtml);
      previewSelectionRef.current = null;
    },
    [onChange]
  );

  const applyFormatCommand = useCallback(
    (command: string, value?: string) => {
      const iframe = iframeRef.current;
      const doc = iframe?.contentDocument;
      if (!doc?.body || !content.trim()) return;

      const body = doc.body;
      body.focus();

      const sel = previewSelectionRef.current;
      if (sel && sel.doc === doc) {
        try {
          const winSel = doc.getSelection();
          if (winSel) {
            winSel.removeAllRanges();
            winSel.addRange(sel.range);
          }
        } catch {
          // Range may be invalid after DOM changes
        }
      } else {
        // No saved selection - place cursor at end for insert commands
        const winSel = doc.getSelection();
        if (winSel) {
          const range = doc.createRange();
          range.selectNodeContents(body);
          range.collapse(false);
          winSel.removeAllRanges();
          winSel.addRange(range);
        }
      }

      doc.execCommand(command, false, value);
      const newHtml = body.innerHTML;
      lastPreviewHtmlRef.current = newHtml;
      onChange(newHtml);
      previewSelectionRef.current = null;
    },
    [content, onChange]
  );

  const handleFormatLink = useCallback(() => {
    const url = window.prompt('Enter URL:', 'https://');
    if (url) {
      applyFormatCommand('createLink', url);
    }
  }, [applyFormatCommand]);

  const insertAtCursor = useCallback(
    (toInsert: string) => {
      // If we have a saved preview selection, insert into preview
      if (previewSelectionRef.current) {
        insertIntoPreview(toInsert);
        return;
      }

      const { start, end } = getInsertPosition();
      const before = content.slice(0, start);
      const after = content.slice(end);
      const newValue = before + toInsert + after;
      onChange(newValue);

      requestAnimationFrame(() => {
        textareaRef.current?.focus();
        const newPos = start + toInsert.length;
        textareaRef.current?.setSelectionRange(newPos, newPos);
      });
    },
    [content, getInsertPosition, insertIntoPreview, onChange]
  );

  const handleTextareaBlur = useCallback(() => {
    if (textareaRef.current) {
      lastCursorRef.current = {
        start: textareaRef.current.selectionStart,
        end: textareaRef.current.selectionEnd,
      };
    }
  }, []);

  const handleVariableSelect = useCallback(
    (value: string) => {
      insertAtCursor(value);
      setVariableSelectValue('');
    },
    [insertAtCursor]
  );

  const handleBlockSelect = useCallback(
    (value: string) => {
      const snippet = EMAIL_BLOCK_SNIPPETS.find((b) => b.id === value);
      if (snippet) {
        insertAtCursor(snippet.html);
      }
      setBlockSelectValue('');
    },
    [insertAtCursor]
  );

  const handleInsertImage = useCallback(() => {
    if (typeof window === 'undefined' || !window.wp?.media) {
      console.error('WordPress media library is not available');
      return;
    }

    const frame = window.wp.media({
      title: 'Select or Upload Image',
      button: { text: 'Use this image' },
      multiple: false,
    });

    frame.on('select', () => {
      const attachment = frame.state().get('selection').first().toJSON();
      const url = attachment.url || '';
      const altRaw = attachment.alt || attachment.title || '';
      const alt = escapeHtmlAttr(altRaw);
      const imgHtml = `<p style="text-align:center;margin:20px 0;"><img src="${url}" alt="${alt}" style="max-width:100%;height:auto;" /></p>`;
      insertAtCursor(imgHtml);
    });

    frame.open();
  }, [insertAtCursor]);

  const handleToolbarMouseDown = useCallback(() => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!doc) return;

    if (document.activeElement !== iframe) return;

    const sel = doc.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0).cloneRange();
    previewSelectionRef.current = { doc, range };
  }, []);

  const previewCleanupRef = useRef<(() => void) | null>(null);

  const handlePreviewLoad = useCallback(() => {
    previewCleanupRef.current?.();

    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!doc?.body) return;

    const body = doc.body;

    const syncFromPreview = () => {
      const html = body.innerHTML;
      lastPreviewHtmlRef.current = html;
      onChange(html);
    };

    body.addEventListener('input', syncFromPreview);
    body.addEventListener('blur', syncFromPreview, true);

    previewCleanupRef.current = () => {
      body.removeEventListener('input', syncFromPreview);
      body.removeEventListener('blur', syncFromPreview, true);
      previewCleanupRef.current = null;
    };
  }, [onChange]);

  useEffect(() => {
    return () => previewCleanupRef.current?.();
  }, []);

  // Update preview srcDoc only when content changes from textarea/toolbar (not from preview edit)
  useEffect(() => {
    if (content === lastPreviewHtmlRef.current) {
      lastPreviewHtmlRef.current = null;
      return;
    }
    setPreviewSrcDoc(createPreviewDoc(content, true));
  }, [content]);

  const toolbar = (
    <div
      ref={toolbarRef}
      className="flex flex-col gap-1 px-2 py-2 w-full border-b bg-background border-input"
      onMouseDown={handleToolbarMouseDown}
    >
      <div className="flex flex-wrap gap-2 items-center">
        {groupedVariables.length > 0 && (
          <Select value={variableSelectValue} onValueChange={handleVariableSelect}>
            <SelectTrigger className="h-8 w-[180px]">
              <SelectValue placeholder="Insert variable" />
            </SelectTrigger>
            <SelectContent>
              {groupedVariables.map((group, groupIndex) => (
                <React.Fragment key={groupIndex}>
                  {groupIndex > 0 && (
                    <div className="my-1 border-t border-border" />
                  )}
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground pointer-events-none">
                    {group.label}
                  </div>
                  {group.variables.map((variable, varIndex) => (
                    <SelectItem key={`${groupIndex}-${varIndex}`} value={variable}>
                      <div className="flex gap-2 items-center">
                        <span className="font-mono text-sm">{variable}</span>
                        <span className="text-xs text-muted-foreground">
                          {variable.replace(/[{}]/g, '').replace(/_/g, ' ')}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </React.Fragment>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={blockSelectValue} onValueChange={handleBlockSelect}>
          <SelectTrigger className="h-8 w-[160px]">
            <SelectValue placeholder="Insert block" />
          </SelectTrigger>
          <SelectContent>
            {EMAIL_BLOCK_SNIPPETS.map((snippet) => (
              <SelectItem key={snippet.id} value={snippet.id}>
                {snippet.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleInsertImage}
            >
              <ImageIcon className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <span>Insert Image</span>
          </TooltipContent>
        </Tooltip>
        <div className="ml-auto">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={showHtmlEditor ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => setShowHtmlEditor((v) => !v)}
              >
                <Code2 className="h-4 w-4" />
                HTML
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <span>{showHtmlEditor ? 'Hide' : 'Show'} HTML editor</span>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
      <div className="flex flex-wrap gap-1 items-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => applyFormatCommand('bold')}
            >
              <Bold className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Bold</TooltipContent>
        </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => applyFormatCommand('italic')}
          >
            <Italic className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Italic</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => applyFormatCommand('strikeThrough')}
          >
            <Strikethrough className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Strikethrough</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleFormatLink}
          >
            <Link2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Insert link</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => applyFormatCommand('insertUnorderedList')}
          >
            <List className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Bullet list</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => applyFormatCommand('insertOrderedList')}
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Ordered list</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => applyFormatCommand('formatBlock', 'blockquote')}
          >
            <TextQuote className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Blockquote</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => applyFormatCommand('insertHorizontalRule')}
          >
            <SeparatorHorizontal className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Horizontal rule</TooltipContent>
      </Tooltip>
      </div>
    </div>
  );

  const editorArea = (
    <Textarea
      ref={textareaRef}
      value={content}
      onChange={(e) => onChange(e.target.value)}
      onBlur={handleTextareaBlur}
      placeholder="Add content below or use blocks to build your email. Use {first_name}, {name} for personalization."
      className="min-h-[10rem] font-mono text-sm resize-none border-0 rounded-none focus-visible:ring-0"
    />
  );

  const isPreviewFullWidth = isDesktop && !showHtmlEditor;
  const previewArea = content.trim() ? (
    <div className="min-h-[400px] flex-1 overflow-auto bg-white rounded border flex justify-center items-start">
      <div
        className="shrink-0 outline-none focus-within:ring-2 focus-within:ring-primary/20 focus-within:ring-offset-2 rounded mx-auto"
        style={
          isPreviewFullWidth
            ? { width: "100%", minHeight: 400 }
            : { transformOrigin: 'top center', width: "100%", minHeight: 400 }
        }
      >
        <iframe
          ref={iframeRef}
          srcDoc={previewSrcDoc}
          title="Email preview"
          className="border-0 block bg-white w-full min-h-[400px] mx-auto"
          sandbox="allow-same-origin"
          onLoad={handlePreviewLoad}
        />
      </div>
    </div>
  ) : (
    <div className="flex justify-center items-center min-h-[400px] text-muted-foreground text-sm border rounded bg-muted/20">
      Add content to see preview
    </div>
  );

  return (
    <div className="overflow-hidden relative pb-3 w-full rounded-md border border-input">
      <div className="sticky top-0 left-0 z-20 bg-background border-input">
        {toolbar}
      </div>
      <div className="min-h-[10rem] p-3 !pb-0">
        {isDesktop ? (
          <div className="flex flex-col gap-4">
            <div
              className={`flex flex-col ${showHtmlEditor ? 'flex-1 min-w-0' : 'flex-1 min-w-0 w-full'}`}
            >
              <div className="text-xs font-medium text-muted-foreground mb-2">
                Preview <span className="font-normal">(click to edit)</span>
              </div>
              {previewArea}
            </div>
            {showHtmlEditor && (
              <div className="flex-1 min-w-[200px] basis-0">{editorArea}</div>
            )}
          </div>
        ) : showHtmlEditor ? (
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'edit' | 'preview')}
          >
            <TabsList className="w-full">
              <TabsTrigger value="edit" className="flex-1">
                Edit
              </TabsTrigger>
              <TabsTrigger value="preview" className="flex-1">
                Preview
              </TabsTrigger>
            </TabsList>
            <TabsContent value="edit" className="mt-2">
              {editorArea}
            </TabsContent>
            <TabsContent value="preview" className="mt-2">
              {previewArea}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="mt-2 flex flex-col flex-1">
            {previewArea}
          </div>
        )}
      </div>
    </div>
  );
}
