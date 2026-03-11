'use client';

import { useState } from 'react';
import SessionBuilder from '../components/SessionBuilder';
import SessionRunner from '../components/SessionRunner';
import SessionResults from '../components/SessionResults';
import type { AppMode, SessionDefinition, SessionResult } from '../lib/sessionTypes';

const INITIAL_SESSION: SessionDefinition = {
  name: 'New Physiotherapy Session',
  steps: []
};

export default function Home() {
  const [mode, setMode] = useState<AppMode>('builder');
  const [session, setSession] = useState<SessionDefinition>(INITIAL_SESSION);
  const [result, setResult] = useState<SessionResult | null>(null);

  if (mode === 'builder') {
    return (
      <SessionBuilder
        value={session}
        onChange={setSession}
        onStart={() => setMode('runner')}
      />
    );
  }

  if (mode === 'runner') {
    return (
      <SessionRunner
        session={session}
        onCancel={() => setMode('builder')}
        onComplete={(nextResult) => {
          setResult(nextResult);
          setMode('results');
        }}
      />
    );
  }

  if (mode === 'results' && result) {
    return (
      <SessionResults
        result={result}
        onBackToBuilder={() => {
          setSession(INITIAL_SESSION);
          setResult(null);
          setMode('builder');
        }}
      />
    );
  }

  return null;
}
