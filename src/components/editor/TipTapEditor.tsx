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
import { useEffect } from 'react';
import { FormattingToolbar } from './FormattingToolbar';
import { IndentExtension } from './IndentExtension';

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

  if (!editor) return null;

  const toolbar = editable && (
    <FormattingToolbar editor={editor} onAddWidget={onAddWidget} position={toolbarPosition} />
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {toolbarPosition === 'top' && toolbar}
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} className="tiptap-editor min-h-full" />
      </div>
      {toolbarPosition === 'bottom' && toolbar}
    </div>
  );
}
