import { hasAdminSession } from "@/lib/admin/auth";
import PasscodeLogin from "./PasscodeLogin";
import "./admin.css";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin workspace · TCF material",
  robots: { index: false, follow: false },
};
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (await hasAdminSession()) ? children : <PasscodeLogin />;
}
