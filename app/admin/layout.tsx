import "./admin.css";
export const metadata = {
  title: "Admin workspace · TCF material",
  robots: { index: false, follow: false },
};
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
