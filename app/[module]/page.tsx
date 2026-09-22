import { notFound } from "next/navigation";
import HomePage from "@/app/page";

const modules = {
  listening: "Listening",
  reading: "Reading",
  writing: "Writing",
  speaking: "Speaking",
} as const;

export default async function ModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  const initialModule = modules[module as keyof typeof modules];
  if (!initialModule) notFound();
  return <HomePage />;
}
