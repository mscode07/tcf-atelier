import { hasAdminSession } from "@/lib/admin/auth";
import PasscodeLogin from "./PasscodeLogin";
import AdminWorkspace from "./AdminWorkspace";
import "./admin.css";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin workspace · TCF material",
  robots: { index: false, follow: false },
};
export default async function AdminPage() {
  if (!(await hasAdminSession())) return <PasscodeLogin />;
  return <AdminWorkspace name="Admin" />;
}
