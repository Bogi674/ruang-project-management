import { NoteEditorWrapper } from '../NoteEditorWrapper';

interface PageProps {
  params: { id: string };
}

export default function NotePage({ params }: PageProps) {
  return <NoteEditorWrapper noteId={params.id} />;
}
