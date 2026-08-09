"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { logoutAction } from "@/app/admin/actions";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/players", label: "Students" },
  { href: "/admin/units", label: "Units" },
  { href: "/admin/qr", label: "QR code" },
];

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="adminbar no-print">
      <div className="adminbar__links">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`adminbar__link${
              pathname === link.href ? " adminbar__link--on" : ""
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>
      <button
        className="exit"
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await logoutAction();
            router.refresh();
          })
        }
      >
        {pending ? "…" : "Sign out"}
      </button>
    </div>
  );
}
