export const MODULES = ["listening", "reading", "writing", "speaking"] as const;
export type ModuleKey = (typeof MODULES)[number];
export const isModule = (value: unknown): value is ModuleKey =>
  MODULES.includes(value as ModuleKey);
export type MaterialQuestion = {
  id: string;
  prompt: string;
  passage: string;
  options: string[];
  correct: string;
  level: string;
  audioUrl: string;
  imageUrl: string;
  explanation: string;
  task: number;
  category: string;
  document1: string;
  document2: string;
  durationSeconds: number;
  referenceAnswer: string;
  extra: Record<string, unknown>;
};
export type MaterialTest = {
  module: ModuleKey;
  testNumber: number;
  title: string;
  status: "draft" | "published" | "archived";
  questions: MaterialQuestion[];
};
export type ContentRecord = MaterialTest & {
  id: string;
  version: number;
  updatedAt: string;
};
export type StudentRecord = {
  id: string;
  name: string | null;
  email: string;
  status: string;
  createdAt: string;
  lastLoginAt: string;
  country: string | null;
  phone: string | null;
};
export type GrantRecord = {
  id: string;
  userId: string;
  module: ModuleKey;
  kind: "grant" | "deny";
  startsAt: string;
  expiresAt: string | null;
  reason: string;
  revokedAt: string | null;
};
export function emptyQuestion(): MaterialQuestion {
  return {
    id: crypto.randomUUID(),
    prompt: "",
    passage: "",
    options: [],
    correct: "",
    level: "A1",
    audioUrl: "",
    imageUrl: "",
    explanation: "",
    task: 1,
    category: "General",
    document1: "",
    document2: "",
    durationSeconds: 210,
    referenceAnswer: "",
    extra: {},
  };
}
