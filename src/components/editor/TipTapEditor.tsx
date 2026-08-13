'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { TextStyle, FontSize } from '@tiptap/extension-text-style';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FormattingToolbar } from './FormattingToolbar';
import { IndentExtension } from './IndentExtension';
import { tiptapToChatText } from '@/lib/export';
import { useKeyboardInset } from '@/lib/keyboardInset';

interface TipTapEditorProps {
  content?: object | null;
  isChecklist?: boolean;
  onChange?: (content: object) => void;
  placeholder?: string;
  editable?: boolean;
  onAddWidget?: () => void;
  toolbarPosition?: 'top' | 'bottom';
}

export function TipTapEditor({
  content,
  isChecklist,
  onChange,
  placeholder = 'Start writing…',
  editable = true,
  onAddWidget,
  toolbarPosition = 'bottom',
}: TipTapEditorProps) {
  const editor = useEditor({
    extensions: [
      // StarterKit v3 already ships underline, strike and link — registering
      // them again produced duplicate-extension warnings and flaky marks.
      StarterKit.configure({ link: { openOnClick: false } }),
      Placeholder.configure({ placeholder }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Subscript,
      Superscript,
      TextStyle,
      FontSize,
      IndentExtension,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: content || (isChecklist
      ? { type: 'doc', content: [{ type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] }] }] }
      : undefined),
    editable,
    editorProps: {
      attributes: { class: 'tiptap-editor' },
      /**
       * WhatsApp (and Telegram, Signal, Slack, any plain-text field) ignores
       * the `text/html` half of the clipboard and pastes `text/plain`.
       * ProseMirror builds that half with `textBetween(from, to, '\n\n')`,
       * which drops every list marker and puts a blank line between blocks —
       * a numbered list arrives as unnumbered, double-spaced prose.
       *
       * Serialising the copied slice ourselves keeps the numbers, the bullets
       * and the emphasis, in the syntax those apps actually render.
       */
      clipboardTextSerializer: (slice) => tiptapToChatText(slice.content.toJSON() ?? []),
    },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getJSON());
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (editor && content && !editor.isFocused) {
      editor.commands.setContent(content);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (editor) editor.setEditable(editable);
  }, [editor, editable]);

  // Portals need a DOM to land in, so the docked bar waits for mount. Doing it
  // this way (rather than rendering the bar in place) keeps the server and the
  // first client render identical — no hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Publishes --kb-inset for the docked mobile toolbar. Only worth measuring
  // while there is actually a toolbar to dock.
  useKeyboardInset(editable);

  if (!editor) return null;

  const toolbar = editable && (
    <FormattingToolbar editor={editor} onAddWidget={onAddWidget} position={toolbarPosition} />
  );

  /*
   * Mobile gets the same controls docked to the bottom of the *visual*
   * viewport instead of sitting at the top of the editor.
   *
   * Two reasons. It stays put while the note scrolls, so the formatting
   * controls are reachable from the paragraph you are actually editing rather
   * than only from the top of the note; and `--kb-inset` lifts it clear of the
   * on-screen keyboard, which is the one place on a phone where a text control
   * is worth having. It is rendered through a portal so no scroll container or
   * transformed ancestor in the editor tree can clip it or break `fixed`.
   */
  const dockedToolbar =
    mounted && editable
      ? createPortal(
          <div className="md:hidden docked-toolbar" data-docked-toolbar="">
            <FormattingToolbar editor={editor} onAddWidget={onAddWidget} position="bottom" />
          </div>,
          document.body
        )
      : null;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* The in-flow strip is desktop-only; on mobile the docked bar replaces
          it rather than doubling up. */}
      {toolbarPosition === 'top' && <div className="hidden md:block">{toolbar}</div>}
      {/* Breathing room between the toolbar and the first line of prose — the
          text used to start flush against the toolbar border. */}
      <div className={`flex-1 overflow-y-auto ${toolbarPosition === 'top' ? 'md:pt-6' : 'pb-5'}`}>
        <EditorContent editor={editor} className="tiptap-editor min-h-full" />
      </div>
      {toolbarPosition === 'bottom' && <div className="hidden md:block">{toolbar}</div>}
      {dockedToolbar}
    </div>
  );
}
