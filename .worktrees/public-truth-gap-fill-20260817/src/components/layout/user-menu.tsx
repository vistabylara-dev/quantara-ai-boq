"use client";

import { ShieldCheck, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";

type SessionUser = {
  fullName: string;
  email: string;
  role: string;
  platformRole: "PLATFORM_OWNER" | "PLATFORM_ADMIN" | "PLATFORM_SUPPORT" | null;
};

export default function UserMenu() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void apiClient
      .get<{ authenticated: boolean; user?: SessionUser }>("/api/auth/session")
      .then((session) => {
        if (!cancelled && session.authenticated && session.user) {
          setUser(session.user);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await apiClient.post("/api/auth/logout");
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  if (!user) {
    return (
      <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 text-slate-300">
        <User className="h-5 w-5" />
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
        title={user.fullName}
      >
        <User className="h-5 w-5" />
      </button>
      {isOpen && (
        <div className="absolute right-0 top-14 z-10 w-64 rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-xl">
          <p className="text-sm font-semibold text-white">{user.fullName}</p>
          <p className="mt-1 truncate text-xs text-slate-400">{user.email}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">
            {user.role.replace(/_/g, " ")}
          </p>
          {user.platformRole === "PLATFORM_OWNER" && (
            <Link
              href="/admin"
              onClick={() => setIsOpen(false)}
              className="mt-4 flex w-full items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
            >
              <ShieldCheck className="h-4 w-4" />
              Owner Console
            </Link>
          )}
          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={isSigningOut}
            className={`${user.platformRole === "PLATFORM_OWNER" ? "mt-2" : "mt-4"} w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-60`}
          >
            {isSigningOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
