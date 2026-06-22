import Sidebar from "./Sidebar";

export default function DashboardLayout({ children }) {
  return (
    <div className="dash-shell">
      <Sidebar />
      <main className="dash-main">{children}</main>
    </div>
  );
}
