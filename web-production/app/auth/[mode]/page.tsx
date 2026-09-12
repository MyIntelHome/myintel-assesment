import { notFound } from "next/navigation";
import { AuthForm } from "./AuthForm";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ mode: string }> }) {
  const { mode } = await params;
  if (!["login", "signup", "recover", "confirm", "password", "logout"].includes(mode)) notFound();
  return <AuthForm mode={mode}/>;
}
