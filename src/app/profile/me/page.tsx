"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useEffect } from "react";

export default function ProfileMeRedirect() {
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.user) {
      const user = session.user;
      if (user.username) {
        redirect(`/profile/${user.username}`);
      }
    }
  }, [session]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-text-muted">Redirecting...</div>
    </div>
  );
}
