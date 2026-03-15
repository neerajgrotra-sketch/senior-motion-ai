"use client";

import { useState } from "react";

import SessionBuilder from "../components/SessionBuilder";
import SessionRunner from "../components/SessionRunner";
import SessionResults from "../components/SessionResults";

import type { SessionDefinition } from "../lib/sessionTypes";
import type { SessionResult } from "../lib/sessionTypes";

const INITIAL_SESSION: SessionDefinition = {
  name: "Mobility Session",
  steps: []
};

type Mode = "builder" | "runner" | "results";

export default function Page() {
  const [mode, setMode] = useState<Mode>("builder");
  const [session, setSession] = useState<SessionDefinition>(INITIAL_SESSION);
  const [result, setResult] = useState<SessionResult | null>(null);

  if (mode === "builder") {
    return (
      <SessionBuilder
        value={session}
        onChange={setSession}
        onStart={() => setMode("runner")}
      />
    );
  }

  if (mode === "runner") {
    return (
      <SessionRunner
        session={session}
        onFinish={(res: SessionResult) => {
          setResult(res);
          setMode("results");
        }}
        onAbort={() => setMode("builder")}
      />
    );
  }

  if (mode === "results" && result) {
    return (
      <SessionResults
        result={result}
        onBackToBuilder={() => {
          setSession(INITIAL_SESSION);
          setMode("builder");
        }}
      />
    );
  }

  return null;
}
