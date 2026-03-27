import { WorkspaceScreen } from "@/components/workspace-screen";

export default async function BookPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  return <WorkspaceScreen bookId={bookId} />;
}
