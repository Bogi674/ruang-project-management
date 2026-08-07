import { Extension } from '@tiptap/core';

export const INDENT_STEP = 32;
export const MAX_INDENT = 8;

const INDENTABLE_TYPES = ['paragraph', 'heading', 'blockquote', 'codeBlock'];

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    indentHandler: {
      /** Increase indent of the selected block(s), or sink a list item. */
      indent: () => ReturnType;
      /** Decrease indent of the selected block(s), or lift a list item. */
      outdent: () => ReturnType;
    };
  }
}

/**
 * Block indentation for paragraphs and headings.
 *
 * Lists have their own nesting model, so Tab inside a list sinks/lifts the list
 * item instead — that is what people expect from Tab in an editor.
 */
export const IndentExtension = Extension.create({
  name: 'indentHandler',

  addGlobalAttributes() {
    return [
      {
        types: INDENTABLE_TYPES,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => {
              const value = parseInt(element.style.marginLeft || '0', 10);
              return Number.isNaN(value) ? 0 : Math.round(value / INDENT_STEP);
            },
            renderHTML: (attributes) => {
              const level = (attributes.indent as number) || 0;
              if (level <= 0) return {};
              return { style: `margin-left: ${level * INDENT_STEP}px` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    const shift = (delta: number) => () => ({ state, tr, dispatch }: {
      state: import('@tiptap/pm/state').EditorState;
      tr: import('@tiptap/pm/state').Transaction;
      dispatch?: (tr: import('@tiptap/pm/state').Transaction) => void;
    }) => {
      const { from, to } = state.selection;
      let changed = false;

      state.doc.nodesBetween(from, to, (node, pos) => {
        if (!INDENTABLE_TYPES.includes(node.type.name)) return;
        const current = (node.attrs.indent as number) || 0;
        const next = Math.min(MAX_INDENT, Math.max(0, current + delta));
        if (next === current) return;
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next });
        changed = true;
      });

      if (changed && dispatch) dispatch(tr);
      return changed;
    };

    return {
      indent: shift(1),
      outdent: shift(-1),
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        // Lists first: Tab nests the item rather than shifting the whole block.
        if (this.editor.can().sinkListItem('taskItem')) {
          return this.editor.commands.sinkListItem('taskItem');
        }
        if (this.editor.can().sinkListItem('listItem')) {
          return this.editor.commands.sinkListItem('listItem');
        }
        return this.editor.commands.indent();
      },
      'Shift-Tab': () => {
        if (this.editor.can().liftListItem('taskItem')) {
          return this.editor.commands.liftListItem('taskItem');
        }
        if (this.editor.can().liftListItem('listItem')) {
          return this.editor.commands.liftListItem('listItem');
        }
        return this.editor.commands.outdent();
      },
    };
  },
});
