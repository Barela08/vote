'use client';

import { useState, useEffect, useRef } from 'react';
import { Header } from '@/components/Header';
import { useRealtime } from '@/lib/useRealtime';
import { Candidate, AuditLog } from '@/lib/types';
import { soundEngine } from '@/lib/soundEngine';
import {
  Lock,
  LogOut,
  Plus,
  Trash2,
  Edit2,
  Play,
  Square,
  PlusCircle,
  Clock,
  Users,
  VoteIcon,
  ShieldAlert,
  Loader2,
  Upload,
  CheckCircle2,
  AlertTriangle,
  History,
  Sparkles,
} from 'lucide-react';
import Image from 'next/image';

export default function AdminPage() {
  const {
    election,
    candidates,
    totalVotes,
    isAdmin: realtimeIsAdmin,
    remainingTime,
    loading: realtimeLoading,
    refetch,
  } = useRealtime();

  // Authentication State
  const [adminCode, setAdminCode] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // Modals & UI Controls
  const [showStartModal, setShowStartModal] = useState<boolean>(false);
  const [selectedDuration, setSelectedDuration] = useState<number>(300); // default 5 minutes (300s)

  const [showAddCandidateModal, setShowAddCandidateModal] = useState<boolean>(false);
  const [candidateName, setCandidateName] = useState<string>('');
  const [candidateParty, setCandidateParty] = useState<string>('');
  const [candidatePhotoUrl, setCandidatePhotoUrl] = useState<string>('');
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);

  const [deletingCandidate, setDeletingCandidate] = useState<Candidate | null>(null);

  // Live Vote Injection
  const [selectedLiveCandidateId, setSelectedLiveCandidateId] = useState<string>('');
  const [liveVoteCount, setLiveVoteCount] = useState<number>(10);
  const [isAddingLiveVotes, setIsAddingLiveVotes] = useState<boolean>(false);

  // Notifications & Audit Log
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [showAuditLogs, setShowAuditLogs] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check auth state from backend
  useEffect(() => {
    setIsAuthenticated(realtimeIsAdmin);
  }, [realtimeIsAdmin]);

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch('/api/admin/audit');
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.auditLogs || []);
      }
    } catch {
      // ignore audit log fetch error
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchAuditLogs();
    }
  }, [isAuthenticated]);

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminCode.trim() || isLoggingIn) return;

    setIsLoggingIn(true);
    setAuthError(null);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: adminCode.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setIsAuthenticated(true);
        setAdminCode('');
        refetch();
      } else {
        setAuthError(data.message || 'Invalid access code');
      }
    } catch (err) {
      setAuthError('Connection error during login');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Logout handler
  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    setIsAuthenticated(false);
    refetch();
  };

  // Photo Upload Handler
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.photo_url) {
        setCandidatePhotoUrl(data.photo_url);
      } else {
        alert(data.message || 'Image upload failed');
      }
    } catch (err) {
      alert('Error uploading image');
    } finally {
      setUploadingImage(false);
    }
  };

  // Save/Update Candidate
  const handleSaveCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateName.trim() || !candidateParty.trim() || !candidatePhotoUrl) {
      alert('Please fill out all fields and upload a photo.');
      return;
    }

    try {
      const url = '/api/admin/candidate';
      const method = editingCandidate ? 'PUT' : 'POST';
      const payload = editingCandidate
        ? { id: editingCandidate.id, name: candidateName, party: candidateParty, photo_url: candidatePhotoUrl }
        : { name: candidateName, party: candidateParty, photo_url: candidatePhotoUrl };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setActionMessage(editingCandidate ? 'Candidate updated!' : 'Candidate added successfully!');
        setShowAddCandidateModal(false);
        setEditingCandidate(null);
        setCandidateName('');
        setCandidateParty('');
        setCandidatePhotoUrl('');
        refetch();
        fetchAuditLogs();
        setTimeout(() => setActionMessage(null), 3000);
      } else {
        alert(data.message || 'Failed to save candidate');
      }
    } catch (err) {
      alert('Error saving candidate');
    }
  };

  // Open edit candidate
  const handleEditClick = (cand: Candidate) => {
    setEditingCandidate(cand);
    setCandidateName(cand.name);
    setCandidateParty(cand.party);
    setCandidatePhotoUrl(cand.photo_url);
    setShowAddCandidateModal(true);
  };

  // Delete Candidate
  const handleConfirmDeleteCandidate = async () => {
    if (!deletingCandidate) return;

    try {
      const res = await fetch(`/api/admin/candidate?id=${deletingCandidate.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionMessage('Candidate deleted!');
        setDeletingCandidate(null);
        refetch();
        fetchAuditLogs();
        setTimeout(() => setActionMessage(null), 3000);
      } else {
        alert(data.message || 'Failed to delete candidate');
      }
    } catch (err) {
      alert('Error deleting candidate');
    }
  };

  // Start Election
  const handleStartElection = async () => {
    try {
      const res = await fetch('/api/admin/election/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationSeconds: selectedDuration }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setShowStartModal(false);
        setActionMessage('Voting started!');
        refetch();
        fetchAuditLogs();
        setTimeout(() => setActionMessage(null), 3000);
      } else {
        alert(data.message || 'Failed to start election');
      }
    } catch (err) {
      alert('Error starting election');
    }
  };

  // End Election Manually
  const handleEndElection = async () => {
    if (!confirm('Are you sure you want to end voting now?')) return;

    try {
      const res = await fetch('/api/admin/election/end', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionMessage('Voting ended manually.');
        refetch();
        fetchAuditLogs();
        setTimeout(() => setActionMessage(null), 3000);
      } else {
        alert(data.message || 'Failed to end election');
      }
    } catch (err) {
      alert('Error ending election');
    }
  };

  // Add Bulk Official Votes
  const handleAddLiveVotes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLiveCandidateId || isAddingLiveVotes || liveVoteCount <= 0) return;

    setIsAddingLiveVotes(true);
    try {
      const res = await fetch('/api/admin/votes/add-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_id: selectedLiveCandidateId,
          count: liveVoteCount,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        soundEngine.playVoteClick();
        setActionMessage(data.message || `Added ${liveVoteCount} official votes!`);
        refetch();
        fetchAuditLogs();
        setTimeout(() => setActionMessage(null), 4000);
      } else {
        alert(data.message || 'Failed to add live votes');
      }
    } catch (err) {
      alert('Error adding live votes');
    } finally {
      setIsAddingLiveVotes(false);
    }
  };

  if (realtimeLoading) {
    return (
      <div className="min-h-screen bg-[#080c14] text-white flex flex-col items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-amber-500 mb-4" />
        <p className="text-slate-400 font-medium">Verifying Admin Session...</p>
      </div>
    );
  }

  // 1. UNAUTHENTICATED ADMIN LOGIN VIEW
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#080c14] text-slate-100 flex flex-col selection:bg-amber-500 selection:text-white">
        <Header isAdminPage />
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="glass-modal w-full max-w-md rounded-3xl p-8 border border-white/10 shadow-2xl glow-blue">
            <div className="flex flex-col items-center text-center mb-8">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 mb-4">
                <Lock className="h-7 w-7" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white">VOTEPRO ADMIN</h1>
              <p className="text-xs text-slate-400 mt-1 font-medium">
                Enter Admin Code to access Control Center
              </p>
            </div>

            {authError && (
              <div className="mb-6 rounded-xl bg-rose-500/20 p-3 text-xs font-semibold text-rose-300 border border-rose-500/30 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="flex flex-col gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Enter Admin Code
                </label>
                <input
                  type="password"
                  maxLength={10}
                  value={adminCode}
                  onChange={(e) => setAdminCode(e.target.value)}
                  placeholder="••••"
                  className="w-full text-center text-2xl font-mono tracking-[0.5em] px-4 py-3 rounded-xl bg-slate-900/90 border border-white/20 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm tracking-wider uppercase shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    AUTHENTICATING...
                  </>
                ) : (
                  'LOGIN'
                )}
              </button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  // 2. AUTHENTICATED ADMIN CONTROL CENTER VIEW
  const status = election?.status || 'NOT_STARTED';

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 flex flex-col">
      <Header isAdminPage />

      {actionMessage && (
        <div className="fixed top-20 right-4 z-50 max-w-md bg-emerald-950/90 border border-emerald-500/40 text-emerald-200 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-3 animate-bounce">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          <p className="text-sm font-semibold">{actionMessage}</p>
        </div>
      )}

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 flex-1 flex flex-col gap-8">
        {/* CONTROL CENTER TOP BAR */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 glass-card p-6 rounded-2xl border border-white/10">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              ADMIN CONTROL CENTER
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Authoritative Election Management & Live Vote Monitor
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => setShowAuditLogs(!showAuditLogs)}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 rounded-xl bg-slate-800/80 px-4 py-2.5 text-xs font-bold text-slate-300 border border-slate-700 hover:bg-slate-700 transition-colors"
            >
              <History className="h-4 w-4 text-blue-400" />
              {showAuditLogs ? 'Hide Audit Log' : 'Audit Log'}
            </button>

            <button
              onClick={handleLogout}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 rounded-xl bg-rose-500/10 px-4 py-2.5 text-xs font-bold text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>

        {/* ELECTION OVERVIEW METRICS & CONTROLS */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-card p-5 rounded-2xl border border-white/10 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Voting Status
              </p>
              <span className="text-lg font-black text-white uppercase">
                {status === 'ACTIVE' && <span className="text-emerald-400">🟢 LIVE</span>}
                {status === 'NOT_STARTED' && <span className="text-amber-400">NOT STARTED</span>}
                {status === 'ENDED' && <span className="text-rose-400">ENDED</span>}
              </span>
            </div>
          </div>

          <div className="glass-card p-5 rounded-2xl border border-white/10 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 shrink-0">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Time Remaining
              </p>
              <span className="font-timer text-2xl font-extrabold text-white">
                {remainingTime}
              </span>
            </div>
          </div>

          <div className="glass-card p-5 rounded-2xl border border-white/10 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shrink-0">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Total Candidates
              </p>
              <span className="text-2xl font-extrabold text-white">{candidates.length}</span>
            </div>
          </div>

          <div className="glass-card p-5 rounded-2xl border border-white/10 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
              <VoteIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Total Votes
              </p>
              <span className="text-2xl font-extrabold text-white">{totalVotes}</span>
            </div>
          </div>
        </section>

        {/* ELECTION ACTION BUTTONS */}
        <section className="flex flex-wrap items-center gap-4">
          <button
            onClick={() => setShowStartModal(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 px-6 py-3.5 text-sm font-black text-white tracking-wider uppercase shadow-lg shadow-emerald-600/30 transition-all active:scale-[0.98]"
          >
            <Play className="h-5 w-5 fill-current" />
            START VOTING
          </button>

          {status === 'ACTIVE' && (
            <button
              onClick={handleEndElection}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-500 px-6 py-3.5 text-sm font-black text-white tracking-wider uppercase shadow-lg shadow-rose-600/30 transition-all active:scale-[0.98]"
            >
              <Square className="h-5 w-5 fill-current" />
              END VOTING
            </button>
          )}

          <button
            onClick={() => {
              setEditingCandidate(null);
              setCandidateName('');
              setCandidateParty('');
              setCandidatePhotoUrl('');
              setShowAddCandidateModal(true);
            }}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all"
          >
            <Plus className="h-5 w-5" />
            ADD CANDIDATE
          </button>
        </section>

        {/* AUDIT LOG VIEWER */}
        {showAuditLogs && (
          <section className="glass-card p-6 rounded-2xl border border-white/10">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <History className="h-5 w-5 text-amber-400" />
              Security Audit Logs
            </h2>
            <div className="max-h-60 overflow-y-auto space-y-2 text-xs font-mono">
              {auditLogs.length === 0 ? (
                <p className="text-slate-500 italic">No audit records logged yet.</p>
              ) : (
                auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-4"
                  >
                    <div>
                      <span className="font-bold text-amber-400 mr-2">[{log.action}]</span>
                      <span className="text-slate-300">
                        {JSON.stringify(log.metadata)}
                      </span>
                    </div>
                    <span className="text-slate-500 shrink-0">
                      {new Date(log.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {/* CANDIDATE BREAKDOWN & MANAGEMENT TABLE */}
        <section className="glass-card rounded-2xl p-6 border border-white/10">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white tracking-tight">
              Candidates & Live Vote Breakdown (Admin Only)
            </h2>
            <span className="text-xs text-slate-400 font-semibold">
              Individual vote counts are strictly hidden from public view
            </span>
          </div>

          {candidates.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              No candidates added yet. Click &apos;ADD CANDIDATE&apos; to create one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-xs font-bold text-slate-400 uppercase">
                    <th className="py-3 px-4">Candidate</th>
                    <th className="py-3 px-4">Party</th>
                    <th className="py-3 px-4 text-center">Individual Votes</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {candidates.map((cand) => (
                    <tr key={cand.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 flex items-center gap-3">
                        <div className="relative h-10 w-10 rounded-lg overflow-hidden border border-white/20 shrink-0">
                          <Image
                            src={cand.photo_url || 'https://via.placeholder.com/100'}
                            alt={cand.name}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                        <span className="font-bold text-white">{cand.name}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-medium">{cand.party}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          {cand.vote_count ?? 0}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEditClick(cand)}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeletingCandidate(cand)}
                            className="p-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-900/60 font-bold border-t-2 border-white/10">
                    <td colSpan={2} className="py-3 px-4 text-white uppercase text-xs">
                      TOTAL ALL CANDIDATES
                    </td>
                    <td className="py-3 px-4 text-center font-black text-emerald-400 text-base">
                      {totalVotes}
                    </td>
                    <td className="py-3 px-4"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* LIVE VOTE MANAGEMENT SECTION */}
        <section className="glass-card rounded-2xl p-6 border border-white/10">
          <h2 className="text-xl font-bold text-white tracking-tight mb-1 flex items-center gap-2">
            <PlusCircle className="h-5 w-5 text-emerald-400" />
            LIVE VOTE MANAGEMENT (Authorized Bulk Votes)
          </h2>
          <p className="text-xs text-slate-400 mb-6">
            Inject official authorized vote batches into Supabase database with full audit trail.
          </p>

          <form onSubmit={handleAddLiveVotes} className="flex flex-col sm:flex-row items-end gap-4">
            <div className="flex-1 w-full">
              <label className="block text-xs font-bold uppercase text-slate-400 mb-2">
                Candidate
              </label>
              <select
                value={selectedLiveCandidateId}
                onChange={(e) => setSelectedLiveCandidateId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-white/20 text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="">-- Select Candidate --</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.party})
                  </option>
                ))}
              </select>
            </div>

            <div className="w-full sm:w-48">
              <label className="block text-xs font-bold uppercase text-slate-400 mb-2">
                Number of Votes
              </label>
              <input
                type="number"
                min={1}
                max={500}
                value={liveVoteCount}
                onChange={(e) => setLiveVoteCount(parseInt(e.target.value, 10) || 1)}
                className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-white/20 text-white focus:outline-none focus:border-emerald-500 font-bold"
              />
            </div>

            <button
              type="submit"
              disabled={isAddingLiveVotes || !selectedLiveCandidateId}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm tracking-wide shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isAddingLiveVotes ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  ADDING VOTES...
                </>
              ) : (
                'ADD VOTES'
              )}
            </button>
          </form>
        </section>
      </main>

      {/* START VOTING TIME CONFIGURATION MODAL */}
      {showStartModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-modal w-full max-w-md rounded-2xl p-6 border border-white/20 shadow-2xl text-center">
            <h3 className="text-xl font-extrabold text-white mb-2">SET VOTING TIME</h3>
            <p className="text-xs text-slate-400 mb-6">Choose authoritative election duration:</p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {[
                { label: '30 Seconds', value: 30 },
                { label: '1 Minute', value: 60 },
                { label: '5 Minutes', value: 300 },
                { label: '10 Minutes', value: 600 },
                { label: '30 Minutes', value: 1800 },
                { label: '1 Hour', value: 3600 },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSelectedDuration(opt.value)}
                  className={`py-3 rounded-xl text-xs font-bold border transition-all ${
                    selectedDuration === opt.value
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500 shadow-md'
                      : 'bg-slate-900/80 text-slate-300 border-white/10 hover:border-white/30'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowStartModal(false)}
                className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 font-semibold text-xs hover:bg-slate-700"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={handleStartElection}
                className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30"
              >
                START VOTING
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT CANDIDATE MODAL */}
      {showAddCandidateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-modal w-full max-w-lg rounded-2xl p-6 border border-white/20 shadow-2xl">
            <h3 className="text-xl font-extrabold text-white mb-6">
              {editingCandidate ? 'EDIT CANDIDATE' : 'ADD NEW CANDIDATE'}
            </h3>

            <form onSubmit={handleSaveCandidate} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Candidate Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter candidate name"
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-white/20 text-white focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Party Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter party name"
                  value={candidateParty}
                  onChange={(e) => setCandidateParty(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-white/20 text-white focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Candidate Photo
                </label>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  ref={fileInputRef}
                  onChange={handlePhotoSelect}
                  className="hidden"
                />

                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-white/10 flex items-center gap-2"
                  >
                    {uploadingImage ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    UPLOAD PHOTO
                  </button>
                  {candidatePhotoUrl && (
                    <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4" /> Photo Selected
                    </span>
                  )}
                </div>

                {/* Photo Preview */}
                {candidatePhotoUrl && (
                  <div className="mt-3 relative h-28 w-28 rounded-xl overflow-hidden border border-white/20">
                    <Image
                      src={candidatePhotoUrl}
                      alt="Preview"
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setShowAddCandidateModal(false)}
                  className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 font-semibold text-xs hover:bg-slate-700"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={uploadingImage}
                  className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30"
                >
                  {editingCandidate ? 'UPDATE CANDIDATE' : 'ADD CANDIDATE'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE CANDIDATE MODAL */}
      {deletingCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-modal w-full max-w-md rounded-2xl p-6 border border-rose-500/30 shadow-2xl text-center">
            <AlertTriangle className="h-10 w-10 text-rose-400 mx-auto mb-3" />
            <h3 className="text-xl font-extrabold text-white mb-2">Delete Candidate</h3>
            <p className="text-sm text-slate-300 mb-6">
              Are you sure you want to delete <span className="font-bold text-white">{deletingCandidate.name}</span>?
              It will immediately be removed across all connected devices and cannot receive votes.
            </p>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setDeletingCandidate(null)}
                className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 font-semibold text-xs hover:bg-slate-700"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCandidate}
                className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30"
              >
                DELETE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
