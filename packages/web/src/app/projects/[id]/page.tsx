import { WorkspacePage } from "@/components/workspace/WorkspacePage";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: Props) {
  const { id } = await params;
  return <WorkspacePage projectId={id} />;
}
