// This page no longer handles note creation.
// All creation is done in the FAB click handler before navigation,
// so the user is always sent directly to /note/[id].
// This redirect exists as a safety net for any stale links.
import { redirect } from 'next/navigation';

export default function NewNotePage() {
  redirect('/home');
}
