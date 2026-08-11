import { SessionView } from "@/sections/SessionView/SessionView";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <SessionView token={token} />;
}
