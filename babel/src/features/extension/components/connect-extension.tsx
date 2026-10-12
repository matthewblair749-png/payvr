"use client";

import { useEffect, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Mascot } from "@/features/brand/mascot";
import { connectExtensionAction } from "../actions";
import { BRIDGE, type ExtensionToWeb, type WebToExtension } from "../bridge";

type State = "checking" | "missing" | "ready" | "connecting" | "connected" | "error";

function post(message: WebToExtension) {
  window.postMessage(message, window.location.origin);
}

/** Waits for a reply of `type` from the extension's bridge script. */
function waitFor(type: ExtensionToWeb["type"], ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      window.removeEventListener("message", onMessage);
      resolve(false);
    }, ms);
    function onMessage(event: MessageEvent) {
      const data = event.data as Partial<ExtensionToWeb> | null;
      if (event.source !== window || event.origin !== window.location.origin || data?.source !== BRIDGE.extension || data.type !== type) return;
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      resolve(true);
    }
    window.addEventListener("message", onMessage);
  });
}

export function ConnectExtension() {
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    let cancelled = false;
    const found = waitFor("pong", 1500);
    post({ source: BRIDGE.web, type: "ping" });
    void found.then((ok) => {
      if (!cancelled) setState(ok ? "ready" : "missing");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function connect() {
    setState("connecting");
    const result = await connectExtensionAction();
    if (!result.ok) return setState("error");
    const done = waitFor("connected", 3000);
    post({ source: BRIDGE.web, type: "connect", token: result.token, email: result.email });
    setState((await done) ? "connected" : "error");
  }

  return (
    <div className="mx-auto max-w-lg text-center">
      <div className="mx-auto w-[110px]">
        <Mascot mood={state === "connected" ? "happy" : state === "connecting" ? "thinking" : "idle"} label="The Babel mascot" />
      </div>
      <h1 className="mt-6 text-4xl sm:text-5xl">{state === "connected" ? "You're connected." : "Connect the extension."}</h1>
      <div role="status" className="mt-4 text-lg text-muted">
        {state === "checking" && <p>Looking for the Babel extension in this browser…</p>}
        {state === "missing" && (
          <p>
            We can&rsquo;t find the Babel extension in this browser. Install it first, then reload this page. While it&rsquo;s in
            testing, it&rsquo;s installed from the project&rsquo;s <code className="font-semibold">extension</code> folder (see its
            README).
          </p>
        )}
        {(state === "ready" || state === "connecting") && (
          <p>This lets the extension translate pages on your account. You can disconnect it from your dashboard at any time.</p>
        )}
        {state === "connected" && <p>Open any page, click the Babel button in your toolbar, and choose Translate.</p>}
        {state === "error" && <p>That didn&rsquo;t work. Reload the page and try again.</p>}
      </div>
      <div className="mt-8 flex justify-center gap-3">
        {(state === "ready" || state === "connecting") && (
          <Button size="lg" onClick={connect} disabled={state === "connecting"}>
            {state === "connecting" ? "Connecting…" : "Connect this browser"}
          </Button>
        )}
        {state === "connected" && (
          <ButtonLink href="/dashboard" size="lg" variant="ink">
            Back to your dashboard
          </ButtonLink>
        )}
      </div>
    </div>
  );
}
