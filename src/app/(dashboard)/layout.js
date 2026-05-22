import Topbar from "./Topbar";

export default function DashboardLayout({ children }) {
  return (
    <div className="dash-shell">
      <Topbar />
      <main className="dash-main">{children}</main>
    </div>
  );
}
