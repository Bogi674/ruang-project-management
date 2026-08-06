'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Strike from '@tiptap/extension-strike';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { useEffect } from 'react';
import { FormattingToolbar } from './FormattingToolbar';

interface TipTapEditorProps {
  content?: object | null;
  isChecklist?: boolean;
  onChange?: (content: object) => void;
  placeholder?: string;
}

export function TipTapEditor({ content, isChecklist, onChange, placeholder = 'Start writing…' }: TipTapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ strike: false }),
      Placeholder.configure({ placeholder }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false }),
      Underline,
      Strike,
      Subscript,
      Superscript,
    ],
    content: content || (isChecklist
      ? { type: 'doc', content: [{ type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] }] }] }
      : undefined),
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
  }, []);

  if (!editor) return null;

  return (
    <div className="flex flex-col flex-1">
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} className="tiptap-editor min-h-full" />
      </div>
      <FormattingToolbar editor={editor} />
    </div>
  );
}
