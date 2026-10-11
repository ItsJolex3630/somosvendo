"use client";

import { useEffect, useRef } from "react";
import { loginWithGoogle } from "@/app/login/actions";

const CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
  "39780826399-626q7bsjaicc7fpa81ibqoffejmabvir.apps.googleusercontent.com";

type GoogleAccounts = {
  accounts: {
    id: {
      initialize: (config: { client_id: string; callback: (res: { credential?: string }) => void }) => void;
      renderButton: (el: HTMLElement | null, options: Record<string, unknown>) => void;
    };
  };
};

export function GoogleSignIn() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const start = () => {
      const google = (window as unknown as { google?: GoogleAccounts }).google;
      if (!google?.accounts?.id) return;
      google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (response) => {
          if (response.credential) void loginWithGoogle(response.credential);
        },
      });
      google.accounts.id.renderButton(ref.current, {
        theme: "filled_black",
        size: "large",
        shape: "pill",
        text: "signin_with",
        logo_alignment: "left",
        width: 300,
      });
    };

    if ((window as unknown as { google?: unknown }).google) {
      start();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = start;
    document.head.appendChild(script);
  }, []);

  return <div ref={ref} className="flex justify-center" />;
}
