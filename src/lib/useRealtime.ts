'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Candidate, Election, ElectionStateResponse } from '@/lib/types';
import { soundEngine } from '@/lib/soundEngine';
import confetti from 'canvas-confetti';

export function useRealtime() {
  const [election, setElection] = useState<Election | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [totalVotes, setTotalVotes] = useState<number>(0);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [winnerCandidate, setWinnerCandidate] = useState<Candidate | null>(null);
  const [tieCandidates, setTieCandidates] = useState<Candidate[] | undefined>(undefined);
  const [remainingTime, setRemainingTime] = useState<string>('00:00');
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);

  const prevStatusRef = useRef<string | null>(null);
  const fanfarePlayedRef = useRef<boolean>(false);

  // Authoritative state fetcher
  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/election/state', { cache: 'no-store' });
      if (res.ok) {
        const data: ElectionStateResponse = await res.json();
        setElection(data.election);
        setCandidates(data.candidates || []);
        setTotalVotes(data.totalVotes || 0);
        setIsAdmin(!!data.isAdmin);
        setWinnerCandidate(data.winnerCandidate || null);
        setTieCandidates(data.tieCandidates);

        // Reset fanfare flag if election status is ACTIVE or NOT_STARTED
        if (data.election?.status !== 'ENDED') {
          fanfarePlayedRef.current = false;
        }

        // Trigger fanfare & confetti if election just transitioned to ENDED
        if (
          data.election?.status === 'ENDED' &&
          !fanfarePlayedRef.current &&
          (data.winnerCandidate || (data.tieCandidates && data.tieCandidates.length > 0))
        ) {
          soundEngine.playWinnerFanfare();
          fanfarePlayedRef.current = true;
          try {
            confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
          } catch {
            // ignore fallback
          }
        }

        prevStatusRef.current = data.election?.status || null;
      }
    } catch (error) {
      console.error('Failed to fetch election state:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Timer calculation hook based strictly on authoritative end_at
  useEffect(() => {
    if (!election || election.status !== 'ACTIVE' || !election.end_at) {
      setRemainingTime('00:00');
      setSecondsLeft(0);
      return;
    }

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const endTime = new Date(election.end_at!).getTime();
      const diff = Math.max(0, Math.floor((endTime - now) / 1000));

      setSecondsLeft(diff);

      const mins = Math.floor(diff / 60);
      const secs = diff % 60;
      const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      setRemainingTime(formatted);

      if (diff > 0) {
        soundEngine.playTick();
      } else {
        // Time hit zero -> refresh state to trigger ENDED status
        fetchState();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [election, fetchState]);

  // Supabase Realtime Subscription Setup & Reconnect handling
  useEffect(() => {
    fetchState();

    const supabase = createClient();

    const channel = supabase
      .channel('votepro_realtime_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'elections' },
        () => {
          fetchState();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'candidates' },
        () => {
          fetchState();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'votes' },
        () => {
          fetchState();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setIsConnected(false);
          // Reconnect logic: refetch authoritative state immediately
          setTimeout(() => {
            fetchState();
          }, 3000);
        }
      });

    // Window focus / online event handlers for instantaneous reconnection check
    const handleOnline = () => {
      setIsConnected(true);
      fetchState();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('focus', handleOnline);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('focus', handleOnline);
    };
  }, [fetchState]);

  return {
    election,
    candidates,
    totalVotes,
    isAdmin,
    winnerCandidate,
    tieCandidates,
    remainingTime,
    secondsLeft,
    isConnected,
    loading,
    refetch: fetchState,
  };
}
