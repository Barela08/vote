'use client';

import { useState } from 'react';
import { Header } from '@/components/Header';
import { useRealtime } from '@/lib/useRealtime';
import { Candidate } from '@/lib/types';
import { soundEngine } from '@/lib/soundEngine';
import {
  Users,
  CheckCircle2,
  Clock,
  Trophy,
  AlertTriangle,
  Loader2,
  VoteIcon,
  WifiOff,
  Sparkles,
  Lock,
} from 'lucide-react';
import Image from 'next/image';

export default function PublicVotingPage() {
  const {
    election,
    candidates,
    totalVotes,
    hasVoted,
    winnerCandidate,
    tieCandidates,
    remainingTime,
    isConnected,
    loading,
    refetch,
  } = useRealtime();

  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [voteSuccessMessage, setVoteSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const status = election?.status || 'NOT_STARTED';

  const handleOpenConfirmModal = (candidate: Candidate) => {
    if (status !== 'ACTIVE' || hasVoted) return;
    soundEngine.playVoteClick();
    setSelectedCandidate(candidate);
  };

  const handleConfirmVote = async () => {
    if (!selectedCandidate || isSubmitting || status !== 'ACTIVE' || hasVoted) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_id: selectedCandidate.id,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        soundEngine.playVoteClick();
        setVoteSuccessMessage(`✓ VOTE RECORDED! Thank you for voting for ${selectedCandidate.name}`);
        setSelectedCandidate(null);
        refetch();
      } else {
        setErrorMessage(data.message || 'You have already voted in this election.');
        setSelectedCandidate(null);
        refetch();
      }
    } catch (err) {
      setErrorMessage('Network error while submitting vote.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080c14] text-white flex flex-col items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-blue-500 mb-4" />
        <p className="text-slate-400 font-medium">Loading VotePro Election Interface...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 flex flex-col selection:bg-blue-500 selection:text-white">
      <Header />

      {/* Disconnect Warning */}
      {!isConnected && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-center text-xs font-semibold text-amber-400 flex items-center justify-center gap-2">
          <WifiOff className="h-4 w-4" />
          <span>Reconnecting to live election stream...</span>
        </div>
      )}

      {/* Persistent "Already Voted" Banner if device voted */}
      {hasVoted && status === 'ACTIVE' && (
        <div className="bg-emerald-500/15 border-b border-emerald-500/30 px-4 py-3 text-center text-sm font-bold text-emerald-300 flex items-center justify-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          <span>✓ VOTE RECORDED — You have already voted in this election.</span>
        </div>
      )}

      {/* Toast Notification */}
      {voteSuccessMessage && (
        <div className="fixed top-20 right-4 z-50 max-w-md bg-emerald-950/90 border border-emerald-500/40 text-emerald-200 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-3 animate-bounce">
          <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0" />
          <p className="text-sm font-semibold">{voteSuccessMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div className="fixed top-20 right-4 z-50 max-w-md bg-rose-950/90 border border-rose-500/40 text-rose-200 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-rose-400 shrink-0" />
          <p className="text-sm font-semibold">{errorMessage}</p>
        </div>
      )}

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 flex-1 flex flex-col gap-8">
        {/* TIMER & ELECTION STATUS SECTION */}
        <section className="relative overflow-hidden rounded-2xl glass-card p-6 sm:p-8 text-center border border-white/10 glow-blue">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-purple-600/10 pointer-events-none" />

          {/* Status Badge */}
          <div className="mb-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider border">
            {status === 'ACTIVE' && (
              <span className="flex items-center gap-2 bg-emerald-500/20 text-emerald-400 border-emerald-500/40">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
                🟢 VOTING LIVE
              </span>
            )}
            {status === 'NOT_STARTED' && (
              <span className="bg-amber-500/20 text-amber-400 border-amber-500/40">
                ⌛ VOTING NOT STARTED
              </span>
            )}
            {status === 'ENDED' && (
              <span className="bg-rose-500/20 text-rose-400 border-rose-500/40">
                🏁 VOTING ENDED
              </span>
            )}
          </div>

          {/* Timer Display */}
          <div className="flex flex-col items-center justify-center">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-blue-400" />
              TIME REMAINING
            </span>
            {status === 'ACTIVE' ? (
              <div className="font-timer text-5xl sm:text-7xl font-extrabold tracking-tight text-white drop-shadow-[0_0_20px_rgba(59,130,246,0.5)]">
                {remainingTime}
              </div>
            ) : status === 'NOT_STARTED' ? (
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-300">
                VOTING NOT STARTED
              </div>
            ) : (
              <div className="text-2xl sm:text-3xl font-extrabold text-rose-400">
                VOTING ENDED
              </div>
            )}
          </div>
        </section>

        {/* PUBLIC USER STATISTICS */}
        <section className="grid grid-cols-2 gap-4 sm:gap-6">
          <div className="glass-card rounded-2xl p-5 sm:p-6 border border-white/10 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 shrink-0">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                TOTAL CANDIDATES
              </p>
              <p className="text-2xl sm:text-4xl font-extrabold text-white">
                {candidates.length}
              </p>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-5 sm:p-6 border border-white/10 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shrink-0">
              <VoteIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                TOTAL VOTES
              </p>
              <p className="text-2xl sm:text-4xl font-extrabold text-white">
                {totalVotes}
              </p>
            </div>
          </div>
        </section>

        {/* WINNER ANNOUNCEMENT BANNER */}
        {status === 'ENDED' && winnerCandidate && (
          <section className="glass-modal rounded-3xl p-6 sm:p-10 border border-amber-500/40 text-center glow-gold relative overflow-hidden animate-pulse-slow">
            <div className="absolute top-0 right-0 p-8 text-amber-500/10 pointer-events-none">
              <Sparkles className="h-48 w-48" />
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/20 px-4 py-1.5 text-xs font-bold text-amber-300 border border-amber-500/30 mb-4">
              <Trophy className="h-4 w-4 text-amber-400" />
              OFFICIAL ELECTION WINNER
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-300 mb-6">🏆 WINNER ANNOUNCEMENT</h2>

            <div className="flex flex-col items-center justify-center gap-4">
              <div className="relative h-32 w-32 sm:h-40 sm:w-40 rounded-2xl overflow-hidden border-4 border-amber-400 shadow-2xl">
                <Image
                  src={winnerCandidate.photo_url || 'https://via.placeholder.com/200?text=Winner'}
                  alt={winnerCandidate.name}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
              <div>
                <h3 className="text-3xl sm:text-4xl font-black text-white">{winnerCandidate.name}</h3>
                <p className="text-lg font-semibold text-amber-400">{winnerCandidate.party}</p>
              </div>
            </div>
          </section>
        )}

        {/* TIE ANNOUNCEMENT BANNER */}
        {status === 'ENDED' && tieCandidates && tieCandidates.length > 0 && !winnerCandidate && (
          <section className="glass-modal rounded-3xl p-6 sm:p-8 border border-rose-500/40 text-center glow-red">
            <div className="inline-flex items-center gap-2 rounded-full bg-rose-500/20 px-4 py-1.5 text-xs font-bold text-rose-300 border border-rose-500/30 mb-4">
              <AlertTriangle className="h-4 w-4 text-rose-400" />
              ELECTION RESULT
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">⚠️ ELECTION TIE</h2>
            <p className="text-sm font-medium text-slate-300 mb-6">
              No single winner has been determined. Tied top candidates:
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              {tieCandidates.map((tc) => (
                <div
                  key={tc.id}
                  className="glass-card rounded-xl p-4 border border-rose-500/30 flex items-center gap-3"
                >
                  <div className="relative h-12 w-12 rounded-lg overflow-hidden border border-white/20">
                    <Image
                      src={tc.photo_url || 'https://via.placeholder.com/100'}
                      alt={tc.name}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-white">{tc.name}</p>
                    <p className="text-xs text-rose-300">{tc.party}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* CANDIDATES GRID SECTION */}
        <section className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              Official Candidates
            </h2>
            <span className="text-xs text-slate-400">
              {hasVoted
                ? 'You have already voted'
                : status === 'ACTIVE'
                ? 'Select candidate to vote'
                : 'Voting is inactive'}
            </span>
          </div>

          {candidates.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center text-slate-400 border border-white/10">
              <p className="text-lg font-semibold mb-2">No candidates available</p>
              <p className="text-xs">Candidates will appear here in real time when added.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {candidates.map((candidate) => (
                <div
                  key={candidate.id}
                  className="glass-card group rounded-2xl p-5 border border-white/10 flex flex-col justify-between hover:border-blue-500/40 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10"
                >
                  <div>
                    {/* Candidate Photo */}
                    <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-4 bg-slate-900 border border-white/5">
                      <Image
                        src={candidate.photo_url || 'https://via.placeholder.com/300?text=Candidate'}
                        alt={candidate.name}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        unoptimized
                      />
                    </div>

                    {/* Candidate Details */}
                    <div className="mb-4">
                      <h3 className="text-xl font-bold text-white tracking-tight group-hover:text-blue-400 transition-colors">
                        {candidate.name}
                      </h3>
                      <p className="text-sm font-medium text-slate-400">{candidate.party}</p>
                    </div>
                  </div>

                  {/* Vote Action Button */}
                  <button
                    onClick={() => handleOpenConfirmModal(candidate)}
                    disabled={status !== 'ACTIVE' || hasVoted}
                    className={`w-full py-3 rounded-xl font-bold text-sm tracking-wide transition-all active:scale-[0.98] ${
                      hasVoted
                        ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 cursor-not-allowed flex items-center justify-center gap-2'
                        : status === 'ACTIVE'
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25 cursor-pointer'
                        : 'bg-slate-800/80 text-slate-500 cursor-not-allowed border border-slate-700/40'
                    }`}
                  >
                    {hasVoted ? (
                      <>
                        <Lock className="h-4 w-4" />
                        ALREADY VOTED
                      </>
                    ) : status === 'ACTIVE' ? (
                      'VOTE'
                    ) : status === 'NOT_STARTED' ? (
                      'VOTING NOT STARTED'
                    ) : (
                      'VOTING CLOSED'
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* CONFIRM VOTE MODAL */}
      {selectedCandidate && !hasVoted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="glass-modal w-full max-w-md rounded-2xl p-6 border border-white/20 shadow-2xl text-center">
            <h3 className="text-xl font-extrabold text-white mb-2">Confirm Your Vote</h3>
            <p className="text-sm text-slate-300 mb-4">
              Are you sure you want to submit your vote for:
            </p>

            <div className="glass-card rounded-xl p-4 mb-6 border border-blue-500/30 flex items-center gap-4 text-left">
              <div className="relative h-16 w-16 rounded-lg overflow-hidden border border-white/20 shrink-0">
                <Image
                  src={selectedCandidate.photo_url || 'https://via.placeholder.com/100'}
                  alt={selectedCandidate.name}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
              <div>
                <h4 className="text-lg font-bold text-white">{selectedCandidate.name}</h4>
                <p className="text-xs font-semibold text-blue-400">{selectedCandidate.party}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedCandidate(null)}
                disabled={isSubmitting}
                className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 font-semibold text-sm hover:bg-slate-700 transition-colors cursor-pointer"
              >
                CANCEL
              </button>
              <button
                onClick={handleConfirmVote}
                disabled={isSubmitting}
                className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    SUBMITTING...
                  </>
                ) : (
                  'CONFIRM VOTE'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
