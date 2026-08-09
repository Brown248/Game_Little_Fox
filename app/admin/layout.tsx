// Single gate for every /admin page: if the session cookie isn't valid, the
// login form is rendered instead of the children, so no admin subpage can be
// reached by typing its URL.

import AdminLogin from "@/components/admin/AdminLogin";
import AdminNav from "@/components/admin/AdminNav";
import { adminPasswordConfigured, isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// The root layout's title template appends " · Little Fox Game".
export const metadata = {
  title: "Admin",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAdmin())) {
    return (
      <main className="page page--narrow">
        <AdminLogin configured={adminPasswordConfigured()} />
      </main>
    );
  }

  return (
    <main className="page page--admin">
      <AdminNav />
      {children}
    </main>
  );
}
