'use client';

import { useState, useEffect } from 'react';
import { Volume2, VolumeX, ShieldCheck, Vote } from 'lucide-react';
import { soundEngine } from '@/lib/soundEngine';
import Link from 'next/link';

interface HeaderProps {
  isAdminPage?: boolean;
}

export function Header({ isAdminPage = false }: HeaderProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);

  useEffect(() => {
    setIsMuted(soundEngine.getIsMuted());
  }, []);

  const handleToggleSound = () => {
    const muted = soundEngine.toggleMute();
    setIsMuted(muted);
    if (!muted) {
      const enabled = soundEngine.enableAudio();
      setAudioEnabled(enabled);
    }
  };

  const handleEnableAudio = () => {
    const enabled = soundEngine.enableAudio();
    setAudioEnabled(enabled);
  };

  return (
    <header className="sticky top-0 z-40 w-full glass-card border-b border-white/10 px-4 py-3 sm:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-lg shadow-blue-500/25 transition-transform group-hover:scale-105">
            <Vote className="h-6 w-6 text-white" />
          </div>
          <div>
            <span className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
              Vote<span className="text-blue-500">Pro</span>
            </span>
            {isAdminPage && (
              <span className="ml-2 rounded-md bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-400 border border-amber-500/30">
                ADMIN
              </span>
            )}
          </div>
        </Link>

        {/* Right Action Controls */}
        <div className="flex items-center gap-3">
          {/* Enable Sound banner if blocked */}
          {!audioEnabled && !isMuted && (
            <button
              onClick={handleEnableAudio}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-blue-500/20 px-3 py-1.5 text-xs font-medium text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 transition-colors"
            >
              Enable Sound
            </button>
          )}

          {/* Sound FX Toggle */}
          <button
            onClick={handleToggleSound}
            aria-label="Toggle Sound Effects"
            className="flex items-center gap-2 rounded-lg bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-200 border border-slate-700/60 hover:bg-slate-700/80 transition-all active:scale-95"
          >
            {isMuted ? (
              <>
                <VolumeX className="h-4 w-4 text-rose-400" />
                <span className="hidden sm:inline text-rose-300">Sound OFF</span>
              </>
            ) : (
              <>
                <Volume2 className="h-4 w-4 text-emerald-400" />
                <span className="hidden sm:inline text-emerald-300">Sound ON</span>
              </>
            )}
          </button>

          {/* Admin Navigation link if on public page */}
          {!isAdminPage && (
            <Link
              href="/admin"
              className="flex items-center gap-1.5 rounded-lg bg-slate-800/60 px-3 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <ShieldCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Admin Access</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
