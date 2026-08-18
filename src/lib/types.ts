export type ElectionStatus = 'NOT_STARTED' | 'ACTIVE' | 'ENDED';

export interface Election {
  id: string;
  title: string;
  status: ElectionStatus;
  start_at: string | null;
  end_at: string | null;
  winner_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Candidate {
  id: string;
  election_id: string;
  name: string;
  party: string;
  photo_url: string;
  is_active: boolean;
  display_order: number;
  vote_count?: number; // Only returned/visible for admin
  created_at: string;
  updated_at: string;
}

export interface Vote {
  id: string;
  election_id: string;
  candidate_id: string;
  voter_identifier: string;
  vote_type: 'PUBLIC' | 'ADMIN';
  created_at: string;
}

export interface AuditLog {
  id: string;
  admin_id: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface ElectionStateResponse {
  election: Election | null;
  candidates: Candidate[];
  totalVotes: number;
  isAdmin: boolean;
  hasVoted: boolean; // Indicates if current device/browser already voted in this election
  tieCandidates?: Candidate[];
  winnerCandidate?: Candidate | null;
}
