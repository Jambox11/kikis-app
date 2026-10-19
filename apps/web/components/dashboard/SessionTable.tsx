'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase';
import { SetupNotice } from '@/components/dashboard/SetupNotice';

type SessionRow = {
  id: string;
  agent_id: string | null;
  status: string;
  created_at: string;
  updated_at: string | null;
};

export function SessionTable() {
  const configured = isSupabaseConfigured();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      const { data, error: fetchError } = await supabase
        .from('sessions')
        .select('id, agent_id, status, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(50);

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setSessions((data ?? []) as SessionRow[]);
      }
      setLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [configured]);

  if (!configured) {
    return <SetupNotice />;
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading sessions…</p>;
  }

  if (error) {
    return <p className="text-sm text-red-500">Failed to load sessions: {error}</p>;
  }

  if (sessions.length === 0) {
    return <p className="text-sm text-muted-foreground">No sessions recorded yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="py-2 pr-4 font-medium">Session</th>
            <th className="py-2 pr-4 font-medium">Agent</th>
            <th className="py-2 pr-4 font-medium">Status</th>
            <th className="py-2 font-medium">Created</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => (
            <tr key={session.id} className="border-b border-border/50">
              <td className="py-2 pr-4 font-mono text-xs">{session.id.slice(0, 8)}</td>
              <td className="py-2 pr-4 font-mono text-xs">
                {session.agent_id ? session.agent_id.slice(0, 8) : '—'}
              </td>
              <td className="py-2 pr-4">{session.status}</td>
              <td className="py-2 text-muted-foreground">
                {new Date(session.created_at).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
