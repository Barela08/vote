/**
 * VotePro - Application Core Engine
 * Manages Election State, Real-time Timer, Secret Admin Vote Injection,
 * Web Audio FX, and Celebratory Winner Announcement.
 */

// Initial Default State (Clean DB with zero dummy candidates)
const DEFAULT_CANDIDATES = [];

// Supabase Cloud Credentials
const SUPABASE_URL = "https://beeyhmoxvumbmgatwgyp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlZXlobW94dnVtYm1nYXR3Z3lwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNDc0NjcsImV4cCI6MjEwMjYyMzQ2N30.7clcOJ6v-L6PnhS6L_J2cysKfsLz6xrnaQ2Zh-rsiXo";

let supabaseClient = null;
if (window.supabase && window.supabase.createClient) {
  try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (e) {}
}

class VoteProApp {
  constructor() {
    this.candidates = [];
    this.status = 'READY'; // 'READY', 'LIVE', 'PAUSED', 'ENDED'
    this.totalDuration = 300; // default 5 mins in seconds
    this.timeRemaining = 300;
    this.timerInterval = null;
    this.userVotedCandidateId = null;
    this.isAdminMode = false;
    this.soundEnabled = true;
    this.adminPin = '5459';
    this.supabaseChannel = null;

    // Audio Context
    this.audioCtx = null;

    // Canvas Confetti variables
    this.confettiParticles = [];
    this.confettiAnimId = null;

    this.init();
  }

  init() {
    this.loadStateFromStorage();
    this.fetchServerState();
    this.bindEvents();
    this.checkRoute();
    this.render();
    this.updateTimerDisplay();
    this.setupRealtimeSync();
  }

  fetchServerState() {
    fetch('/api/state')
      .then(res => res.json())
      .then(state => {
        if (state && Array.isArray(state.candidates) && state.candidates.length > 0) {
          this.candidates = state.candidates;
          if (state.status) this.status = state.status;
          if (state.timeRemaining !== undefined) this.timeRemaining = state.timeRemaining;
          if (state.totalDuration !== undefined) this.totalDuration = state.totalDuration;
          this.saveCandidates();
          this.render();
          this.updateTimerDisplay();
        }
      })
      .catch(() => {});
  }

  setupRealtimeSync() {
    // 1. Supabase Cloud Realtime Channel Broadcast
    if (supabaseClient) {
      try {
        const channel = supabaseClient.channel('election_realtime_channel');
        channel.on('broadcast', { event: 'state_update' }, (payload) => {
          if (payload && payload.payload && Array.isArray(payload.payload.candidates) && payload.payload.candidates.length > 0) {
            const state = payload.payload;
            this.candidates = state.candidates;
            this.status = state.status;
            if (state.timeRemaining !== undefined) this.timeRemaining = state.timeRemaining;
            this.saveCandidates();
            this.render();
            this.updateTimerDisplay();
          }
        }).subscribe();
        this.supabaseChannel = channel;
      } catch (e) {}
    }

    // 2. Server Event Stream Fallback
    if (!!window.EventSource) {
      const source = new EventSource('/api/stream');
      source.onmessage = (e) => {
        try {
          const state = JSON.parse(e.data);
          if (state && Array.isArray(state.candidates) && state.candidates.length > 0) {
            this.candidates = state.candidates;
            this.status = state.status;
            this.totalDuration = state.totalDuration;
            this.timeRemaining = state.timeRemaining;
            this.saveCandidates();
            this.render();
            this.updateTimerDisplay();

            if (this.status === 'ENDED' && document.getElementById('winnerModal').classList.contains('hidden')) {
              this.showWinnerModal();
            }
          }
        } catch (err) {}
      };
    }
  }

  broadcastSupabaseState() {
    if (this.supabaseChannel) {
      try {
        this.supabaseChannel.send({
          type: 'broadcast',
          event: 'state_update',
          payload: {
            candidates: this.candidates,
            status: this.status,
            timeRemaining: this.timeRemaining,
            totalDuration: this.totalDuration
          }
        }).catch(() => {});
      } catch (e) {}
    }
  }

  saveState() {
    this.saveCandidates();
    localStorage.setItem('votepro_status', this.status);
    localStorage.setItem('votepro_time_remaining', this.timeRemaining.toString());
    localStorage.setItem('votepro_total_duration', this.totalDuration.toString());
    if (this.userVotedCandidateId) {
      localStorage.setItem('votepro_user_voted', this.userVotedCandidateId);
    } else {
      localStorage.removeItem('votepro_user_voted');
    }

    this.broadcastSupabaseState();

    // Persist candidates and status to Vercel Server API
    fetch('/api/admin/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidates: this.candidates,
        status: this.status,
        timeRemaining: this.timeRemaining,
        totalDuration: this.totalDuration
      })
    }).catch(() => {});
  }

  /* ==========================================
     LOCAL STORAGE & STATE MANAGEMENT
     ========================================== */
  loadStateFromStorage() {
    const savedCandidates = localStorage.getItem('votepro_candidates');
    if (savedCandidates) {
      try {
        const parsed = JSON.parse(savedCandidates);
        // If old sample candidates exist, clear them permanently
        if (Array.isArray(parsed) && parsed.some(c => c.id === 'cand_1' || c.id === 'cand_2' || c.id === 'cand_3')) {
          this.candidates = [];
          localStorage.setItem('votepro_candidates', JSON.stringify([]));
          localStorage.removeItem('votepro_user_voted');
          localStorage.removeItem('votepro_voted_device');
        } else if (Array.isArray(parsed)) {
          this.candidates = parsed;
        } else {
          this.candidates = [];
        }
      } catch (e) {
        this.candidates = [];
      }
    } else {
      this.candidates = [];
    }

    const savedStatus = localStorage.getItem('votepro_status');
    if (savedStatus) this.status = savedStatus;

    const savedTimeRem = localStorage.getItem('votepro_time_remaining');
    if (savedTimeRem !== null) this.timeRemaining = parseInt(savedTimeRem, 10);

    const savedDuration = localStorage.getItem('votepro_total_duration');
    if (savedDuration !== null) this.totalDuration = parseInt(savedDuration, 10);

    const savedUserVoted = localStorage.getItem('votepro_user_voted');
    if (savedUserVoted) this.userVotedCandidateId = savedUserVoted;

    // Auto-start live timer if candidates exist and election is not ended
    if (this.candidates.length > 0 && this.status !== 'ENDED') {
      this.status = 'LIVE';
      if (this.timeRemaining <= 0) {
        this.timeRemaining = this.totalDuration > 0 ? this.totalDuration : 300;
      }
      this.startTimerLoop();
    } else if (this.status === 'ENDED') {
      // If completed, show winner modal on load
      setTimeout(() => this.showWinnerModal(), 500);
    }
  }

  saveCandidates() {
    localStorage.setItem('votepro_candidates', JSON.stringify(this.candidates));
  }

  saveState() {
    this.saveCandidates();
    localStorage.setItem('votepro_status', this.status);
    localStorage.setItem('votepro_time_remaining', this.timeRemaining.toString());
    localStorage.setItem('votepro_total_duration', this.totalDuration.toString());
    if (this.userVotedCandidateId) {
      localStorage.setItem('votepro_user_voted', this.userVotedCandidateId);
    } else {
      localStorage.removeItem('votepro_user_voted');
    }
    this.broadcastSupabaseState();
  }

  /* ==========================================
     WEB AUDIO FX ENGINE
     ========================================== */
  initAudio() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  playSound(type) {
    if (!this.soundEnabled) return;
    this.initAudio();
    if (!this.audioCtx) return;

    const now = this.audioCtx.currentTime;

    if (type === 'vote') {
      // Pleasant dual tone chime
      const osc1 = this.audioCtx.createOscillator();
      const osc2 = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(523.25, now); // C5
      osc2.frequency.setValueAtTime(659.25, now + 0.08); // E5

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc1.start(now);
      osc2.start(now + 0.08);
      osc1.stop(now + 0.35);
      osc2.stop(now + 0.35);
    } else if (type === 'inject') {
      // Secret Admin Boost magic sound (arcade coin flourish)
      const notes = [440, 554.37, 659.25, 880];
      notes.forEach((freq, i) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.05);

        gain.gain.setValueAtTime(0.12, now + i * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.15);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now + i * 0.05);
        osc.stop(now + i * 0.05 + 0.15);
      });
    } else if (type === 'tick') {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(800, now);
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.04);
    } else if (type === 'fanfare') {
      // Victory fanfare chord
      const chords = [523.25, 659.25, 783.99, 1046.50]; // C Major
      chords.forEach((freq) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now);
        osc.stop(now + 1.2);
      });
    }
  }

  checkRoute() {
    const isAdminRoute = window.location.hash === '#admin' || 
                         window.location.pathname.endsWith('/admin') || 
                         window.location.pathname.includes('/admin');

    if (isAdminRoute) {
      if (this.isAdminMode) {
        this.switchView('admin');
      } else {
        this.openPinModal();
      }
    } else {
      this.switchView('voter');
    }
  }

  /* ==========================================
     EVENT BINDINGS
     ========================================== */
  bindEvents() {
    // Audio button toggle
    document.getElementById('soundToggleBtn').addEventListener('click', () => {
      this.soundEnabled = !this.soundEnabled;
      const icon = document.querySelector('#soundToggleBtn i');
      if (this.soundEnabled) {
        icon.className = 'fa-solid fa-volume-high';
      } else {
        icon.className = 'fa-solid fa-volume-xmark';
      }
    });

    // Logout Admin button inside Admin panel
    const logoutBtn = document.getElementById('logoutAdminBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        this.isAdminMode = false;
        if (window.location.hash === '#admin') {
          window.location.hash = '';
        }
        if (window.location.pathname.includes('/admin')) {
          history.pushState(null, '', '/');
        }
        this.switchView('voter');
        this.logAudit('System', 'Admin logged out successfully.');
      });
    }

    // Hash & URL change listener
    window.addEventListener('hashchange', () => this.checkRoute());
    window.addEventListener('popstate', () => this.checkRoute());

    // Storage change listener to sync across tabs instantly
    window.addEventListener('storage', (e) => {
      this.loadStateFromStorage();
      this.render();
      this.updateTimerDisplay();
    });

    // Hidden Keyboard Shortcut: Ctrl + Shift + A to trigger Admin login
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        window.location.hash = 'admin';
      }
    });

    // PIN Modal controls
    document.getElementById('closePinModalBtn').addEventListener('click', () => {
      this.closePinModal();
      if (!this.isAdminMode) {
        if (window.location.hash === '#admin') window.location.hash = '';
        if (window.location.pathname.includes('/admin')) history.pushState(null, '', '/');
      }
    });
    document.getElementById('submitPinBtn').addEventListener('click', () => this.verifyPin());
    document.getElementById('adminPinInput').addEventListener('keyup', (e) => {
      if (e.key === 'Enter') this.verifyPin();
    });

    // File Upload change listener
    const photoFileInput = document.getElementById('candPhotoFile');
    if (photoFileInput) {
      photoFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            this.uploadedPhotoBase64 = event.target.result;
            const previewWrap = document.getElementById('uploadPreviewWrap');
            const previewImg = document.getElementById('uploadPreviewImg');
            const previewName = document.getElementById('uploadPreviewName');
            
            previewImg.src = this.uploadedPhotoBase64;
            previewName.textContent = `✓ ${file.name}`;
            previewWrap.classList.remove('hidden');
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // Preset Avatars selection in Add Candidate Form
    const presetImgs = document.querySelectorAll('#presetAvatars img');
    presetImgs.forEach((img) => {
      img.addEventListener('click', (e) => {
        presetImgs.forEach((i) => i.classList.remove('active'));
        e.target.classList.add('active');
        document.getElementById('candAvatar').value = e.target.getAttribute('data-src');
        this.uploadedPhotoBase64 = null;
        document.getElementById('uploadPreviewWrap').classList.add('hidden');
      });
    });

    // Form: Add Candidate
    document.getElementById('addCandidateForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleAddCandidate();
    });

    // Admin Controls
    document.getElementById('startElectionBtn').addEventListener('click', () => this.startElection());
    document.getElementById('pauseElectionBtn').addEventListener('click', () => this.pauseElection());
    document.getElementById('endElectionBtn').addEventListener('click', () => this.endElection());
    document.getElementById('resetElectionBtn').addEventListener('click', () => this.resetElection());

    // Timer Config
    document.getElementById('applyTimerBtn').addEventListener('click', () => this.applyTimerConfig());

    // Winner Modal close & reset
    document.getElementById('closeWinnerModalBtn').addEventListener('click', () => {
      document.getElementById('winnerModal').classList.add('hidden');
      this.stopConfetti();
    });
    document.getElementById('restartNewElectionBtn').addEventListener('click', () => {
      document.getElementById('winnerModal').classList.add('hidden');
      this.stopConfetti();
      this.resetElection();
    });
  }

  /* ==========================================
     ADMIN PIN & VIEW SWITCHING
     ========================================== */
  openPinModal() {
    document.getElementById('adminPinModal').classList.remove('hidden');
    document.getElementById('pinErrorMsg').classList.add('hidden');
    document.getElementById('adminPinInput').value = '';
    document.getElementById('adminPinInput').focus();
  }

  closePinModal() {
    document.getElementById('adminPinModal').classList.add('hidden');
  }

  verifyPin() {
    const enteredPin = document.getElementById('adminPinInput').value;
    if (enteredPin === this.adminPin) {
      this.isAdminMode = true;
      this.closePinModal();
      window.location.hash = 'admin';
      this.switchView('admin');
      this.logAudit('System', 'Admin authenticated successfully.');
    } else {
      document.getElementById('pinErrorMsg').classList.remove('hidden');
      this.playSound('tick');
    }
  }

  switchView(viewName) {
    const voterSec = document.getElementById('voterView');
    const adminSec = document.getElementById('adminView');

    if (viewName === 'admin') {
      voterSec.classList.remove('active');
      voterSec.classList.add('hidden');
      adminSec.classList.remove('hidden');
      adminSec.classList.add('active');
    } else {
      adminSec.classList.remove('active');
      adminSec.classList.add('hidden');
      voterSec.classList.remove('hidden');
      voterSec.classList.add('active');
    }
    this.render();
  }

  /* ==========================================
     TIMER ENGINE
     ========================================== */
  applyTimerConfig() {
    const mins = parseInt(document.getElementById('timerInputMinutes').value, 10) || 0;
    const secs = parseInt(document.getElementById('timerInputSeconds').value, 10) || 0;

    const totalSecs = mins * 60 + secs;
    if (totalSecs <= 0) {
      alert('Please set a duration greater than 0 seconds.');
      return;
    }

    this.totalDuration = totalSecs;
    this.timeRemaining = totalSecs;
    this.saveState();
    this.updateTimerDisplay();
    this.logAudit('System', `Timer updated to ${mins}m ${secs}s.`);
    alert(`Timer set to ${mins} minute(s) and ${secs} second(s). Click "Start Voting" to begin!`);
  }

  startElection() {
    if (this.candidates.length === 0) {
      alert('Please add at least 1 candidate before starting voting!');
      return;
    }

    if (this.timeRemaining <= 0) {
      this.timeRemaining = this.totalDuration;
    }

    this.status = 'LIVE';
    this.saveState();
    this.startTimerLoop();
    this.render();
    this.logAudit('System', 'Voting started live!');
  }

  pauseElection() {
    this.status = 'PAUSED';
    clearInterval(this.timerInterval);
    this.saveState();
    this.render();
    this.logAudit('System', 'Voting paused by Admin.');
  }

  startTimerLoop() {
    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (this.timeRemaining > 0) {
        this.timeRemaining--;
        this.updateTimerDisplay();
        this.saveState();

        // Optional tick sound during final 10 seconds
        if (this.timeRemaining <= 10 && this.timeRemaining > 0) {
          this.playSound('tick');
        }
      } else {
        // Timer reached 0:00!
        clearInterval(this.timerInterval);
        this.endElection();
      }
    }, 1000);
  }

  updateTimerDisplay() {
    const mins = Math.floor(this.timeRemaining / 60);
    const secs = this.timeRemaining % 60;

    document.getElementById('timerMinutes').textContent = String(mins).padStart(2, '0');
    document.getElementById('timerSeconds').textContent = String(secs).padStart(2, '0');

    const progressPercent = this.totalDuration > 0 ? (this.timeRemaining / this.totalDuration) * 100 : 0;
    const pBar = document.getElementById('timerProgressBar');
    pBar.style.width = `${progressPercent}%`;

    if (progressPercent < 20) {
      pBar.classList.add('warning');
    } else {
      pBar.classList.remove('warning');
    }
  }

  endElection() {
    clearInterval(this.timerInterval);
    this.status = 'ENDED';
    this.saveState();
    this.render();
    this.logAudit('System', 'Election timer ended! Revealing results.');
    this.showWinnerModal();
  }

  resetElection() {
    if (confirm('Are you sure you want to reset all vote counts and restart the election?')) {
      clearInterval(this.timerInterval);
      this.candidates.forEach((c) => (c.votes = 0));
      this.status = 'READY';
      this.timeRemaining = this.totalDuration;
      this.userVotedCandidateId = null;
      localStorage.removeItem('votepro_voted_device');
      localStorage.removeItem('votepro_user_voted');
      this.saveState();
      this.render();
      this.updateTimerDisplay();
      this.logAudit('System', 'Election reset complete. All device vote locks cleared.');
    }
  }

  /* ==========================================
     VOTING & SECRET ADMIN BOOST ENGINE
     ========================================== */
  castUserVote(candId) {
    if (this.status !== 'LIVE') {
      alert('Voting is currently not live. Please wait for the admin to start the election.');
      return;
    }

    const deviceVoted = localStorage.getItem('votepro_voted_device');
    if (this.userVotedCandidateId || deviceVoted === 'true') {
      alert('⚠️ Iss device / browser se pehle hi vote diya ja chuka hai! Ek device se sirf 1 vote allow hai.');
      return;
    }

    const cand = this.candidates.find((c) => c.id === candId);
    if (!cand) return;

    cand.votes++;
    this.userVotedCandidateId = candId;
    localStorage.setItem('votepro_voted_device', 'true');
    this.saveState();

    // Broadcast to Server & all connected devices
    fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candId, amount: 1 })
    }).catch(() => {});

    this.playSound('vote');
    this.render();
    this.logAudit('Voter', `Standard vote recorded for ${cand.name}`);
  }

  /**
   * Secret Admin Injection / Backdoor Vote Boosting
   */
  injectVotes(candId, boostCount) {
    const cand = this.candidates.find((c) => c.id === candId);
    if (!cand) return;

    cand.votes += boostCount;
    this.saveState();

    // Broadcast boost to Server & all connected devices
    fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candId, amount: boostCount })
    }).catch(() => {});

    this.playSound('inject');
    this.render();
    this.logAudit('Inject', `⚡ Secret Boost: Injected +${boostCount} votes to ${cand.name} (Total: ${cand.votes})`);
  }

  overrideVotes(candId, exactVotes) {
    const cand = this.candidates.find((c) => c.id === candId);
    if (!cand) return;

    const val = parseInt(exactVotes, 10);
    if (isNaN(val) || val < 0) return;

    cand.votes = val;
    this.saveState();
    this.playSound('inject');
    this.render();
    this.logAudit('Inject', `✏️ Manual Override: Set ${cand.name} votes directly to ${val}`);
  }

  /* ==========================================
     CANDIDATE MANAGEMENT (ADMIN)
     ========================================== */
  handleAddCandidate() {
    const name = document.getElementById('candName').value.trim();
    const party = document.getElementById('candParty').value.trim();
    let avatar = this.uploadedPhotoBase64 || document.getElementById('candAvatar').value.trim();
    const bio = document.getElementById('candBio').value.trim();

    if (!name || !party) return;

    if (!avatar) {
      avatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80';
    }

    const newCand = {
      id: 'cand_' + Date.now(),
      name,
      party,
      avatar,
      bio: bio || 'Official Election Candidate',
      votes: 0
    };

    this.candidates.push(newCand);
    this.saveState();
    this.render();

    // Reset Form & Photo Upload State
    document.getElementById('addCandidateForm').reset();
    this.uploadedPhotoBase64 = null;
    const previewWrap = document.getElementById('uploadPreviewWrap');
    if (previewWrap) previewWrap.classList.add('hidden');

    this.logAudit('Admin', `Added new candidate: ${name}`);
  }

  deleteCandidate(candId) {
    const cand = this.candidates.find((c) => c.id === candId);
    if (!cand) return;

    if (confirm(`Delete candidate "${cand.name}"?`)) {
      this.candidates = this.candidates.filter((c) => c.id !== candId);
      this.saveState();
      this.render();
      this.logAudit('Admin', `Deleted candidate: ${cand.name}`);
    }
  }

  /* ==========================================
     AUDIT LOGS
     ========================================== */
  logAudit(type, message) {
    const container = document.getElementById('auditLogContainer');
    if (!container) return;

    const entry = document.createElement('div');
    const nowStr = new Date().toLocaleTimeString();
    entry.className = `log-entry ${type.toLowerCase()}`;
    entry.innerHTML = `<span class="log-time">[${nowStr}] [${type}]</span> ${message}`;

    container.prepend(entry);
  }

  /* ==========================================
     RENDER FUNCTIONS
     ========================================== */
  render() {
    this.renderHeaderStatus();
    this.renderVoterView();
    this.renderAdminView();
  }

  renderHeaderStatus() {
    const badge = document.getElementById('electionStatusBadge');
    const statusText = document.getElementById('statusText');
    const timerSubtext = document.getElementById('timerSubtext');

    badge.className = 'status-badge ' + this.status.toLowerCase();
    statusText.textContent = this.status;

    if (this.status === 'LIVE') {
      timerSubtext.textContent = '🔴 VOTING IS LIVE! Timer counting down...';
    } else if (this.status === 'PAUSED') {
      timerSubtext.textContent = '⏸ Voting paused by Admin.';
    } else if (this.status === 'ENDED') {
      timerSubtext.textContent = '🏆 Election Finished! Winner declared.';
    } else {
      timerSubtext.textContent = 'Ready to start election.';
    }
  }

  renderVoterView() {
    const grid = document.getElementById('candidatesGrid');
    const totalVotesEl = document.getElementById('totalVotesCount');
    const totalCandEl = document.getElementById('totalCandidatesCount');
    const votedBanner = document.getElementById('votedAlertBanner');
    const votedText = document.getElementById('votedAlertText');

    const totalVotes = this.candidates.reduce((sum, c) => sum + c.votes, 0);
    totalVotesEl.textContent = totalVotes.toLocaleString();
    totalCandEl.textContent = this.candidates.length;

    // Render candidate cards
    grid.innerHTML = '';
    if (this.candidates.length === 0) {
      grid.innerHTML = `
        <div class="glass-card" style="grid-column: 1/-1; text-align: center; padding: 40px;">
          <i class="fa-solid fa-users-slash" style="font-size: 2.5rem; color: var(--text-dim); margin-bottom: 12px;"></i>
          <h3>No Candidates Registered Yet</h3>
          <p style="color: var(--text-muted);">Please ask the Admin to add candidates from the Admin Panel.</p>
        </div>
      `;
      return;
    }

    // Sort candidates by votes to assign rank badges
    const sorted = [...this.candidates].sort((a, b) => b.votes - a.votes);

    this.candidates.forEach((cand) => {
      const rank = sorted.findIndex((c) => c.id === cand.id) + 1;
      const percent = totalVotes > 0 ? ((cand.votes / totalVotes) * 100).toFixed(1) : '0.0';

      const isVotedThis = this.userVotedCandidateId === cand.id;
      const isDisabled = this.status !== 'LIVE' || !!this.userVotedCandidateId;

      const card = document.createElement('div');
      card.className = 'candidate-card';
      card.innerHTML = `
        <div class="candidate-header">
          <div class="cand-avatar-wrap">
            <img src="${cand.avatar}" alt="${cand.name}" class="cand-avatar" onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'" />
            <span class="cand-rank-tag">#${rank}</span>
          </div>
          <div class="cand-details">
            <h3 class="cand-name">${cand.name}</h3>
            <div class="cand-party">${cand.party}</div>
            <div class="cand-bio">${cand.bio}</div>
          </div>
        </div>

        <div class="cand-vote-stats">
          <div class="vote-meta">
            <span class="vote-count-text"><i class="fa-solid fa-check"></i> ${cand.votes.toLocaleString()} Votes</span>
            <span class="vote-percent-text">${percent}%</span>
          </div>
          <div class="vote-bar-track">
            <div class="vote-bar-fill" style="width: ${percent}%;"></div>
          </div>
        </div>

        <button class="vote-btn" ${isDisabled ? 'disabled' : ''} data-id="${cand.id}">
          <i class="fa-solid ${isVotedThis ? 'fa-circle-check' : 'fa-vote-yea'}"></i>
          ${isVotedThis ? 'VOTED' : 'VOTE FOR CANDIDATE'}
        </button>
      `;

      card.querySelector('.vote-btn').addEventListener('click', () => {
        this.castUserVote(cand.id);
      });

      grid.appendChild(card);
    });

    // Voted alert banner
    if (this.userVotedCandidateId) {
      const votedCand = this.candidates.find((c) => c.id === this.userVotedCandidateId);
      votedBanner.classList.remove('hidden');
      votedText.textContent = `You cast your vote for ${votedCand ? votedCand.name : 'Candidate'}. Live results update automatically.`;
    } else {
      votedBanner.classList.add('hidden');
    }
  }

  renderAdminView() {
    const list = document.getElementById('adminCandidatesList');
    const startBtn = document.getElementById('startElectionBtn');
    const pauseBtn = document.getElementById('pauseElectionBtn');

    if (this.status === 'LIVE') {
      startBtn.classList.add('hidden');
      pauseBtn.classList.remove('hidden');
    } else {
      startBtn.classList.remove('hidden');
      pauseBtn.classList.add('hidden');
    }

    list.innerHTML = '';
    if (this.candidates.length === 0) {
      list.innerHTML = `<p style="color: var(--text-muted);">No candidates added yet. Add one from the form on the left.</p>`;
      return;
    }

    this.candidates.forEach((cand) => {
      const item = document.createElement('div');
      item.className = 'admin-cand-item';
      item.innerHTML = `
        <div class="admin-cand-top">
          <div class="admin-cand-info">
            <img src="${cand.avatar}" alt="${cand.name}" class="admin-cand-avatar" onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'"/>
            <div class="admin-cand-title">
              <h4>${cand.name}</h4>
              <span>${cand.party}</span>
            </div>
          </div>
          <div class="admin-cand-stats">
            <div class="cand-current-votes">${cand.votes.toLocaleString()} Votes</div>
          </div>
        </div>

        <div class="injection-controls-bar">
          <span class="inject-label"><i class="fa-solid fa-bolt"></i> Secret Boost:</span>
          <button class="inject-btn" data-id="${cand.id}" data-add="1">+1</button>
          <button class="inject-btn" data-id="${cand.id}" data-add="2">+2</button>
          <button class="inject-btn" data-id="${cand.id}" data-add="5">+5</button>
          <button class="inject-btn" data-id="${cand.id}" data-add="10">+10</button>
          <button class="inject-btn huge" data-id="${cand.id}" data-add="50">+50</button>
          <button class="inject-btn huge" data-id="${cand.id}" data-add="100">+100</button>

          <div class="custom-inject-box">
            <input type="number" class="custom-inject-input" placeholder="Count" min="1" id="customInput_${cand.id}" />
            <button class="inject-btn" style="background: var(--primary); color:#fff;" id="customInjectBtn_${cand.id}">Inject</button>
          </div>

          <button class="delete-cand-btn" id="deleteBtn_${cand.id}" title="Delete Candidate">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      `;

      // Quick boost buttons
      item.querySelectorAll('.inject-btn[data-add]').forEach((b) => {
        b.addEventListener('click', (e) => {
          const addVal = parseInt(e.target.getAttribute('data-add'), 10);
          this.injectVotes(cand.id, addVal);
        });
      });

      // Custom count injection button
      item.querySelector(`#customInjectBtn_${cand.id}`).addEventListener('click', () => {
        const customInput = item.querySelector(`#customInput_${cand.id}`);
        const count = parseInt(customInput.value, 10);
        if (count && count > 0) {
          this.injectVotes(cand.id, count);
          customInput.value = '';
        }
      });

      // Delete button
      item.querySelector(`#deleteBtn_${cand.id}`).addEventListener('click', () => {
        this.deleteCandidate(cand.id);
      });

      list.appendChild(item);
    });
  }

  /* ==========================================
     WINNER MODAL & CONFETTI CELEBRATION
     ========================================== */
  showWinnerModal() {
    const modal = document.getElementById('winnerModal');
    const spotlight = document.getElementById('winnerSpotlight');
    const standingsList = document.getElementById('finalStandingsList');

    if (this.candidates.length === 0) return;

    // Play victory sound
    this.playSound('fanfare');

    // Sort candidates descending by votes
    const sorted = [...this.candidates].sort((a, b) => b.votes - a.votes);
    const winner = sorted[0];

    const totalVotes = this.candidates.reduce((sum, c) => sum + c.votes, 0);
    const winnerPercent = totalVotes > 0 ? ((winner.votes / totalVotes) * 100).toFixed(1) : '0.0';

    // Render Winner Spotlight Card
    spotlight.innerHTML = `
      <div class="winner-spotlight-card">
        <img src="${winner.avatar}" alt="${winner.name}" class="winner-spotlight-avatar" onerror="this.src='https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80'" />
        <div class="winner-spotlight-info">
          <h3>👑 ${winner.name}</h3>
          <p>${winner.party}</p>
          <div class="winner-vote-pill">
            🏆 WINNER WITH ${winner.votes.toLocaleString()} VOTES (${winnerPercent}%)
          </div>
        </div>
      </div>
    `;

    // Render Standings
    standingsList.innerHTML = '';
    sorted.forEach((cand, idx) => {
      const row = document.createElement('div');
      row.className = 'standing-row';
      const pct = totalVotes > 0 ? ((cand.votes / totalVotes) * 100).toFixed(1) : '0';
      row.innerHTML = `
        <span class="standing-rank">#${idx + 1}</span>
        <span class="standing-name">${idx === 0 ? '👑 ' : ''}${cand.name} (${cand.party})</span>
        <span class="standing-votes">${cand.votes.toLocaleString()} Votes (${pct}%)</span>
      `;
      standingsList.appendChild(row);
    });

    modal.classList.remove('hidden');
    this.startConfetti();
  }

  /* Canvas Confetti Animation */
  startConfetti() {
    const canvas = document.getElementById('confettiCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e', '#a855f7', '#fde047'];
    this.confettiParticles = [];

    for (let i = 0; i < 150; i++) {
      this.confettiParticles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        speedY: Math.random() * 3 + 2,
        speedX: Math.random() * 2 - 1,
        rotation: Math.random() * 360,
        rotSpeed: Math.random() * 10 - 5
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      this.confettiParticles.forEach((p) => {
        p.y += p.speedY;
        p.x += p.speedX;
        p.rotation += p.rotSpeed;

        if (p.y > canvas.height) {
          p.y = -10;
          p.x = Math.random() * canvas.width;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      });

      this.confettiAnimId = requestAnimationFrame(animate);
    };

    if (this.confettiAnimId) cancelAnimationFrame(this.confettiAnimId);
    animate();
  }

  stopConfetti() {
    if (this.confettiAnimId) {
      cancelAnimationFrame(this.confettiAnimId);
    }
  }
}

// Initialize Application on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  window.voteApp = new VoteProApp();
});
