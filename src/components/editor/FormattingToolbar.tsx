'use client';

import { Editor, useEditorState } from '@tiptap/react';
import { useState, useRef, useEffect } from 'react';

interface ToolbarButtonProps {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarButton({ onClick, active, disabled, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`w-8 h-8 flex items-center justify-center rounded-lg text-12 font-medium flex-shrink-0 transition-colors duration-80 disabled:opacity-35 disabled:cursor-not-allowed ${
        active
          ? 'bg-accent-blue-bg text-accent-blue-dark'
          : 'text-text-muted hover:text-text-secondary hover:bg-bg-subtle'
      }`}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-4 bg-border-default flex-shrink-0 mx-0.5" />;
}

/** Small dropdown anchored under its trigger, closed on outside click / Escape. */
function Dropdown({
  label,
  width = 132,
  minTriggerWidth = 92,
  children,
}: {
  label: string;
  width?: number;
  minTriggerWidth?: number;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`h-8 px-2 flex items-center justify-between gap-1.5 rounded-lg text-[12px] transition-colors duration-80 ${
          open ? 'bg-accent-blue-bg text-accent-blue-dark' : 'text-text-secondary hover:bg-bg-subtle'
        }`}
        style={{ minWidth: minTriggerWidth }}
      >
        <span className="truncate">{label}</span>
        <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
          <path d="m3 4.5 3 3 3-3"/>
        </svg>
      </button>
      {open && (
        <div
          className="absolute left-0 top-full mt-1 bg-bg-base border border-border-default rounded-[10px] py-1 z-50 max-h-[280px] overflow-y-auto"
          style={{ width, boxShadow: 'var(--shadow-modal)' }}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  onClick,
  active,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-1.5 text-[12.5px] hover:bg-bg-surface transition-colors flex items-center gap-2 ${
        active ? 'text-accent-blue-dark font-medium bg-accent-blue-bg/40' : 'text-text-secondary'
      }`}
    >
      {children}
    </button>
  );
}

const FONT_SIZES = ['12px', '13px', '14px', '15px', '16px', '18px', '20px', '24px', '30px'];

interface FormattingToolbarProps {
  editor: Editor;
  onAddWidget?: () => void;
  position?: 'top' | 'bottom';
}

export function FormattingToolbar({ editor, onAddWidget, position = 'bottom' }: FormattingToolbarProps) {
  // `useEditor` does not re-render on transactions by default in TipTap v3, so
  // active states must be subscribed to explicitly. Selecting just these flags
  // keeps the toolbar from re-rendering on every keystroke.
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
      isH1: e.isActive('heading', { level: 1 }),
      isH2: e.isActive('heading', { level: 2 }),
      isH3: e.isActive('heading', { level: 3 }),
      isCodeBlock: e.isActive('codeBlock'),
      isBlockquote: e.isActive('blockquote'),
      isBulletList: e.isActive('bulletList'),
      isOrderedList: e.isActive('orderedList'),
      isTaskList: e.isActive('taskList'),
      isBold: e.isActive('bold'),
      isItalic: e.isActive('italic'),
      isStrike: e.isActive('strike'),
      isUnderline: e.isActive('underline'),
      isCode: e.isActive('code'),
      isSuperscript: e.isActive('superscript'),
      isSubscript: e.isActive('subscript'),
      inTable: e.isActive('table'),
      fontSize: (e.getAttributes('textStyle')?.fontSize as string | undefined) || 'Default',
    }),
  });

  const inTable = state.inTable;

  // Current block type, for the dropdown label.
  const blockLabel = state.isH1
    ? 'Heading 1'
    : state.isH2
    ? 'Heading 2'
    : state.isH3
    ? 'Heading 3'
    : state.isCodeBlock
    ? 'Code'
    : state.isBlockquote
    ? 'Quote'
    : 'Paragraph';

  const currentSize = state.fontSize;

  return (
    // The scrolling row and the pinned Add button are siblings, so Add is
    // always reachable instead of being pushed off the end of the scroll area.
    <div
      className={`${position === 'top' ? 'border-b' : 'border-t'} border-border-default bg-bg-base flex items-stretch flex-shrink-0`}
    >
      <div className="flex-1 min-w-0 h-[46px] flex items-center px-3 gap-0.5 overflow-x-auto toolbar-scroll">
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Undo" disabled={!state.canUndo}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Redo" disabled={!state.canRedo}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/></svg>
        </ToolbarButton>

        <ToolbarDivider />

        {/* Block type */}
        <Dropdown label={blockLabel} width={150} minTriggerWidth={96}>
          {(close) => (
            <>
              <MenuItem
                active={blockLabel === 'Paragraph'}
                onClick={() => { editor.chain().focus().setParagraph().run(); close(); }}
              >
                <span className="text-[13px]">Paragraph</span>
              </MenuItem>
              {([1, 2, 3] as const).map((level) => (
                <MenuItem
                  key={level}
                  active={level === 1 ? state.isH1 : level === 2 ? state.isH2 : state.isH3}
                  onClick={() => { editor.chain().focus().toggleHeading({ level }).run(); close(); }}
                >
                  <span
                    className="font-serif text-text-primary"
                    style={{ fontSize: level === 1 ? 19 : level === 2 ? 16.5 : 14.5 }}
                  >
                    Heading {level}
                  </span>
                </MenuItem>
              ))}
              <div className="h-px bg-border-light mx-2 my-1" />
              <MenuItem
                active={state.isBlockquote}
                onClick={() => { editor.chain().focus().toggleBlockquote().run(); close(); }}
              >
                <span className="italic">Quote</span>
              </MenuItem>
              <MenuItem
                active={state.isCodeBlock}
                onClick={() => { editor.chain().focus().toggleCodeBlock().run(); close(); }}
              >
                <span className="font-mono text-[11.5px]">Code block</span>
              </MenuItem>
            </>
          )}
        </Dropdown>

        {/* Font size */}
        <Dropdown label={currentSize} width={110} minTriggerWidth={72}>
          {(close) => (
            <>
              <MenuItem
                active={currentSize === 'Default'}
                onClick={() => { editor.chain().focus().unsetFontSize().run(); close(); }}
              >
                Default
              </MenuItem>
              <div className="h-px bg-border-light mx-2 my-1" />
              {FONT_SIZES.map((size) => (
                <MenuItem
                  key={size}
                  active={currentSize === size}
                  onClick={() => { editor.chain().focus().setFontSize(size).run(); close(); }}
                >
                  <span style={{ fontSize: Math.min(parseInt(size, 10), 18) }}>{size}</span>
                </MenuItem>
              ))}
            </>
          )}
        </Dropdown>

        <ToolbarDivider />

        {/* Lists */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={state.isBulletList} title="Bullet list">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={state.isOrderedList} title="Ordered list">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleTaskList().run()} active={state.isTaskList} title="Checklist">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        </ToolbarButton>

        <ToolbarDivider />

        {/* Indentation */}
        <ToolbarButton onClick={() => editor.chain().focus().outdent().run()} title="Decrease indent (Shift+Tab)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="6" x2="11" y2="6"/><line x1="21" y1="12" x2="11" y2="12"/><line x1="21" y1="18" x2="11" y2="18"/><polyline points="7 8 3 12 7 16"/></svg>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().indent().run()} title="Increase indent (Tab)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="6" x2="11" y2="6"/><line x1="21" y1="12" x2="11" y2="12"/><line x1="21" y1="18" x2="11" y2="18"/><polyline points="3 8 7 12 3 16"/></svg>
        </ToolbarButton>

        <ToolbarDivider />

        {/* Inline marks */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={state.isBold} title="Bold">
          <strong style={{ fontFamily: 'serif' }}>B</strong>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={state.isItalic} title="Italic">
          <em style={{ fontFamily: 'serif' }}>I</em>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={state.isStrike} title="Strikethrough">
          <s>S</s>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={state.isUnderline} title="Underline">
          <u>U</u>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} active={state.isCode} title="Inline code">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleSuperscript().run()} active={state.isSuperscript} title="Superscript">
          x²
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleSubscript().run()} active={state.isSubscript} title="Subscript">
          x₂
        </ToolbarButton>

        <ToolbarDivider />

        {/* Table */}
        <Dropdown label="Table" width={168} minTriggerWidth={72}>
          {(close) => (
            <>
              <MenuItem
                onClick={() => {
                  editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
                  close();
                }}
              >
                Insert 3 × 3 table
              </MenuItem>
              {inTable && (
                <>
                  <div className="h-px bg-border-light mx-2 my-1" />
                  <MenuItem onClick={() => { editor.chain().focus().addColumnBefore().run(); close(); }}>Add column before</MenuItem>
                  <MenuItem onClick={() => { editor.chain().focus().addColumnAfter().run(); close(); }}>Add column after</MenuItem>
                  <MenuItem onClick={() => { editor.chain().focus().addRowBefore().run(); close(); }}>Add row before</MenuItem>
                  <MenuItem onClick={() => { editor.chain().focus().addRowAfter().run(); close(); }}>Add row after</MenuItem>
                  <MenuItem onClick={() => { editor.chain().focus().toggleHeaderRow().run(); close(); }}>Toggle header row</MenuItem>
                  <MenuItem onClick={() => { editor.chain().focus().mergeOrSplit().run(); close(); }}>Merge / split cells</MenuItem>
                  <div className="h-px bg-border-light mx-2 my-1" />
                  <button
                    type="button"
                    onClick={() => { editor.chain().focus().deleteColumn().run(); close(); }}
                    className="w-full text-left px-3 py-1.5 text-[12.5px] text-danger hover:bg-danger-bg transition-colors"
                  >
                    Delete column
                  </button>
                  <button
                    type="button"
                    onClick={() => { editor.chain().focus().deleteRow().run(); close(); }}
                    className="w-full text-left px-3 py-1.5 text-[12.5px] text-danger hover:bg-danger-bg transition-colors"
                  >
                    Delete row
                  </button>
                  <button
                    type="button"
                    onClick={() => { editor.chain().focus().deleteTable().run(); close(); }}
                    className="w-full text-left px-3 py-1.5 text-[12.5px] text-danger hover:bg-danger-bg transition-colors"
                  >
                    Delete table
                  </button>
                </>
              )}
            </>
          )}
        </Dropdown>

        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="3" y1="12" x2="21" y2="12"/></svg>
        </ToolbarButton>
      </div>

      {/* Pinned Add button — never scrolls out of reach */}
      {onAddWidget && (
        <div className="flex items-center pl-1.5 pr-3 border-l border-border-default flex-shrink-0 bg-bg-base">
          <button
            type="button"
            onClick={onAddWidget}
            className="flex items-center gap-1.5 px-3 h-7 text-12 text-text-secondary border border-border-default rounded-lg hover:bg-bg-subtle transition-colors duration-120 whitespace-nowrap"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="6" y1="1" x2="6" y2="11"/><line x1="1" y1="6" x2="11" y2="6"/></svg>
            Add
          </button>
        </div>
      )}
    </div>
  );
}
