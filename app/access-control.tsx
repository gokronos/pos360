"use client";
import { useEffect, useState } from "react";
export type Session = {
  user: { id: string; email: string; name: string; role: string };
  tenant: { id: string; name: string };
  branch: { id: string; name: string };
  modules: string[];
};
export function useAccess() {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    let active = true;
    void fetch("/api/bootstrap")
      .then(async (r) => {
        const text = await r.text();
        if (!r.ok)
          throw new Error(text || `Error ${r.status} al iniciar POS360`);
        return text ? JSON.parse(text) : {};
      })
      .then((d) => {
        if (active && d.user)
          setSession({
            user: d.user,
            tenant: d.tenant,
            branch: d.branch,
            modules: d.modules || [],
          });
      })
      .catch((error) => console.error("No fue posible iniciar POS360", error));
    return () => {
      active = false;
    };
  }, []);
  return {
    session,
    can: (module: string) => !session || session.modules.includes(module),
  };
}
