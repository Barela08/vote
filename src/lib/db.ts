import { getAdminSupabaseClient } from '@/lib/supabase/server';
import { Candidate, Election, Vote, AuditLog } from '@/lib/types';

// In-Memory Fallback Store (for offline / placeholder Supabase testing)
interface LocalStore {
  election: Election;
  candidates: Candidate[];
  votes: Vote[];
  auditLogs: AuditLog[];
}

const globalStore = global as unknown as { __votepro_store?: LocalStore };

if (!globalStore.__votepro_store) {
  globalStore.__votepro_store = {
    election: {
      id: 'e1001-default-election',
      title: 'VotePro Main Election',
      status: 'NOT_STARTED',
      start_at: null,
      end_at: null,
      winner_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    candidates: [],
    votes: [],
    auditLogs: [],
  };
}

const store = globalStore.__votepro_store;

function isPlaceholderUrl(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  return !url || url.includes('placeholder') || url.includes('your-supabase');
}

export async function dbHasVoted(electionId: string, voterIdentifier: string): Promise<boolean> {
  if (!isPlaceholderUrl()) {
    try {
      const supabase = getAdminSupabaseClient();
      const { data } = await supabase
        .from('votes')
        .select('id')
        .eq('election_id', electionId)
        .eq('voter_identifier', voterIdentifier)
        .eq('vote_type', 'PUBLIC')
        .limit(1);

      return !!(data && data.length > 0);
    } catch (err) {
      console.warn('Supabase hasVoted check failed, checking local store:', err);
    }
  }

  return store.votes.some(
    (v) => v.election_id === electionId && v.voter_identifier === voterIdentifier && v.vote_type === 'PUBLIC'
  );
}

export async function dbGetElectionState(voterIdentifier?: string) {
  if (!isPlaceholderUrl()) {
    try {
      const supabase = getAdminSupabaseClient();
      const { data: elections } = await supabase
        .from('elections')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (elections && elections.length > 0) {
        let election: Election = elections[0];

        // Check if expired
        if (election.status === 'ACTIVE' && election.end_at) {
          const now = new Date();
          if (now >= new Date(election.end_at)) {
            election.status = 'ENDED';
            await supabase
              .from('elections')
              .update({ status: 'ENDED', updated_at: now.toISOString() })
              .eq('id', election.id);
          }
        }

        const { data: candidatesData } = await supabase
          .from('candidates')
          .select('*')
          .eq('election_id', election.id)
          .eq('is_active', true)
          .order('display_order', { ascending: true })
          .order('created_at', { ascending: true });

        const { data: votesData } = await supabase
          .from('votes')
          .select('*')
          .eq('election_id', election.id);

        const candidates: Candidate[] = candidatesData || [];
        const votes: Vote[] = votesData || [];

        let hasVoted = false;
        if (voterIdentifier) {
          hasVoted = votes.some(
            (v) => v.voter_identifier === voterIdentifier && v.vote_type === 'PUBLIC'
          );
        }

        return { election, candidates, votes, hasVoted };
      }
    } catch (err) {
      console.warn('Supabase fetch failed, using local store fallback:', err);
    }
  }

  // Fallback to local store
  if (store.election.status === 'ACTIVE' && store.election.end_at) {
    if (new Date() >= new Date(store.election.end_at)) {
      store.election.status = 'ENDED';
      store.election.updated_at = new Date().toISOString();
    }
  }

  const hasVoted = voterIdentifier
    ? store.votes.some(
        (v) =>
          v.election_id === store.election.id &&
          v.voter_identifier === voterIdentifier &&
          v.vote_type === 'PUBLIC'
      )
    : false;

  return {
    election: store.election,
    candidates: store.candidates.filter((c) => c.is_active),
    votes: store.votes,
    hasVoted,
  };
}

export async function dbAddCandidate(name: string, party: string, photo_url: string) {
  if (!isPlaceholderUrl()) {
    try {
      const supabase = getAdminSupabaseClient();
      let { data: elections } = await supabase
        .from('elections')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1);

      let targetElectionId = elections && elections.length > 0 ? elections[0].id : null;
      if (!targetElectionId) {
        const { data: newElection } = await supabase
          .from('elections')
          .insert({ title: 'VotePro Main Election', status: 'NOT_STARTED' })
          .select('id')
          .single();
        if (newElection) targetElectionId = newElection.id;
      }

      if (targetElectionId) {
        const { data: candidate, error } = await supabase
          .from('candidates')
          .insert({
            election_id: targetElectionId,
            name: name.trim(),
            party: party.trim(),
            photo_url,
            is_active: true,
          })
          .select()
          .single();

        if (!error && candidate) {
          await supabase.from('audit_logs').insert({
            admin_id: 'admin',
            action: 'ADD_CANDIDATE',
            entity_type: 'CANDIDATE',
            entity_id: candidate.id,
            metadata: { name: candidate.name, party: candidate.party },
          });
          return candidate;
        }
      }
    } catch (err) {
      console.warn('Supabase insert candidate failed, falling back to local store:', err);
    }
  }

  // Fallback candidate insert
  const newCandidate: Candidate = {
    id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    election_id: store.election.id,
    name: name.trim(),
    party: party.trim(),
    photo_url,
    is_active: true,
    display_order: store.candidates.length,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  store.candidates.push(newCandidate);
  store.auditLogs.unshift({
    id: `audit_${Date.now()}`,
    admin_id: 'admin',
    action: 'ADD_CANDIDATE',
    entity_type: 'CANDIDATE',
    entity_id: newCandidate.id,
    metadata: { name: newCandidate.name, party: newCandidate.party },
    created_at: new Date().toISOString(),
  });

  return newCandidate;
}

export async function dbEditCandidate(id: string, name?: string, party?: string, photo_url?: string) {
  if (!isPlaceholderUrl()) {
    try {
      const supabase = getAdminSupabaseClient();
      const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
      if (name) updatePayload.name = name.trim();
      if (party) updatePayload.party = party.trim();
      if (photo_url) updatePayload.photo_url = photo_url;

      const { data: candidate, error } = await supabase
        .from('candidates')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (!error && candidate) {
        await supabase.from('audit_logs').insert({
          admin_id: 'admin',
          action: 'EDIT_CANDIDATE',
          entity_type: 'CANDIDATE',
          entity_id: id,
          metadata: updatePayload,
        });
        return candidate;
      }
    } catch (err) {
      console.warn('Supabase edit candidate failed, falling back to local store:', err);
    }
  }

  const candidateIndex = store.candidates.findIndex((c) => c.id === id);
  if (candidateIndex !== -1) {
    if (name) store.candidates[candidateIndex].name = name.trim();
    if (party) store.candidates[candidateIndex].party = party.trim();
    if (photo_url) store.candidates[candidateIndex].photo_url = photo_url;
    store.candidates[candidateIndex].updated_at = new Date().toISOString();

    store.auditLogs.unshift({
      id: `audit_${Date.now()}`,
      admin_id: 'admin',
      action: 'EDIT_CANDIDATE',
      entity_type: 'CANDIDATE',
      entity_id: id,
      metadata: { name, party },
      created_at: new Date().toISOString(),
    });

    return store.candidates[candidateIndex];
  }

  throw new Error('Candidate not found');
}

export async function dbDeleteCandidate(id: string) {
  if (!isPlaceholderUrl()) {
    try {
      const supabase = getAdminSupabaseClient();
      const { error } = await supabase
        .from('candidates')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (!error) {
        await supabase.from('audit_logs').insert({
          admin_id: 'admin',
          action: 'DELETE_CANDIDATE',
          entity_type: 'CANDIDATE',
          entity_id: id,
          metadata: { deleted_at: new Date().toISOString() },
        });
        return true;
      }
    } catch (err) {
      console.warn('Supabase delete candidate failed, falling back to local store:', err);
    }
  }

  const cand = store.candidates.find((c) => c.id === id);
  if (cand) {
    cand.is_active = false;
    cand.updated_at = new Date().toISOString();
    store.auditLogs.unshift({
      id: `audit_${Date.now()}`,
      admin_id: 'admin',
      action: 'DELETE_CANDIDATE',
      entity_type: 'CANDIDATE',
      entity_id: id,
      metadata: { deleted_at: new Date().toISOString() },
      created_at: new Date().toISOString(),
    });
    return true;
  }

  return false;
}

export async function dbStartElection(durationSeconds: number) {
  const now = new Date();
  const startAt = now.toISOString();
  const endAt = new Date(now.getTime() + durationSeconds * 1000).toISOString();

  if (!isPlaceholderUrl()) {
    try {
      const supabase = getAdminSupabaseClient();
      const { data: existing } = await supabase
        .from('elections')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (existing && existing.length > 0) {
        const { data: updated } = await supabase
          .from('elections')
          .update({
            status: 'ACTIVE',
            start_at: startAt,
            end_at: endAt,
            winner_id: null,
            updated_at: startAt,
          })
          .eq('id', existing[0].id)
          .select()
          .single();

        if (updated) return updated;
      } else {
        const { data: created } = await supabase
          .from('elections')
          .insert({
            title: 'VotePro Official Election',
            status: 'ACTIVE',
            start_at: startAt,
            end_at: endAt,
          })
          .select()
          .single();

        if (created) return created;
      }
    } catch (err) {
      console.warn('Supabase start election failed, using fallback:', err);
    }
  }

  store.election.status = 'ACTIVE';
  store.election.start_at = startAt;
  store.election.end_at = endAt;
  store.election.winner_id = null;
  store.election.updated_at = startAt;

  store.auditLogs.unshift({
    id: `audit_${Date.now()}`,
    admin_id: 'admin',
    action: 'START_ELECTION',
    entity_type: 'ELECTION',
    entity_id: store.election.id,
    metadata: { durationSeconds, start_at: startAt, end_at: endAt },
    created_at: startAt,
  });

  return store.election;
}

export async function dbEndElection() {
  const now = new Date().toISOString();

  if (!isPlaceholderUrl()) {
    try {
      const supabase = getAdminSupabaseClient();
      const { data: existing } = await supabase
        .from('elections')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (existing && existing.length > 0) {
        const { data: updated } = await supabase
          .from('elections')
          .update({ status: 'ENDED', updated_at: now })
          .eq('id', existing[0].id)
          .select()
          .single();

        if (updated) return updated;
      }
    } catch (err) {
      console.warn('Supabase end election failed, using fallback:', err);
    }
  }

  store.election.status = 'ENDED';
  store.election.updated_at = now;

  store.auditLogs.unshift({
    id: `audit_${Date.now()}`,
    admin_id: 'admin',
    action: 'END_ELECTION',
    entity_type: 'ELECTION',
    entity_id: store.election.id,
    metadata: { ended_at: now, manual: true },
    created_at: now,
  });

  return store.election;
}

export async function dbCastPublicVote(candidateId: string, voterIdentifier: string) {
  const { election, candidates } = await dbGetElectionState(voterIdentifier);

  if (!election || election.status !== 'ACTIVE') {
    throw new Error('Voting is not active');
  }

  if (election.end_at && new Date() >= new Date(election.end_at)) {
    throw new Error('Voting has ended');
  }

  // Check if voter identifier already voted
  const alreadyVoted = await dbHasVoted(election.id, voterIdentifier);
  if (alreadyVoted) {
    throw new Error('You have already voted in this election.');
  }

  const candidate = candidates.find((c) => c.id === candidateId && c.is_active);
  if (!candidate) {
    throw new Error('Invalid or inactive candidate');
  }

  if (!isPlaceholderUrl()) {
    try {
      const supabase = getAdminSupabaseClient();
      const { data: vote, error } = await supabase
        .from('votes')
        .insert({
          election_id: election.id,
          candidate_id: candidate.id,
          voter_identifier: voterIdentifier,
          vote_type: 'PUBLIC',
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505' || error.message.includes('unique constraint') || error.message.includes('idx_unique_public_voter')) {
          throw new Error('You have already voted in this election.');
        }
        console.warn('Supabase vote error:', error);
      } else if (vote) {
        return vote;
      }
    } catch (err: any) {
      if (err.message?.includes('already voted')) {
        throw err;
      }
      console.warn('Supabase vote insert failed, using fallback:', err);
    }
  }

  // Fallback vote cast with duplicate check
  if (store.votes.some((v) => v.election_id === election.id && v.voter_identifier === voterIdentifier && v.vote_type === 'PUBLIC')) {
    throw new Error('You have already voted in this election.');
  }

  const newVote: Vote = {
    id: `v_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    election_id: election.id,
    candidate_id: candidate.id,
    voter_identifier: voterIdentifier,
    vote_type: 'PUBLIC',
    created_at: new Date().toISOString(),
  };

  store.votes.push(newVote);
  return newVote;
}

export async function dbAddBulkVotes(candidateId: string, count: number) {
  const { election, candidates } = await dbGetElectionState();

  const candidate = candidates.find((c) => c.id === candidateId && c.is_active);
  if (!candidate) {
    throw new Error('Candidate not found or inactive');
  }

  const now = new Date().toISOString();

  if (!isPlaceholderUrl()) {
    try {
      const supabase = getAdminSupabaseClient();
      const records = Array.from({ length: count }).map((_, i) => ({
        election_id: election ? election.id : candidate.election_id,
        candidate_id: candidate.id,
        voter_identifier: `admin_bulk_${Date.now()}_${i}`,
        vote_type: 'ADMIN' as const,
        created_at: now,
      }));

      const { error } = await supabase.from('votes').insert(records);
      if (!error) {
        await supabase.from('audit_logs').insert({
          admin_id: 'admin',
          action: 'ADD_OFFICIAL_VOTES',
          entity_type: 'CANDIDATE',
          entity_id: candidate.id,
          metadata: { count, candidate_name: candidate.name, timestamp: now },
        });
        return true;
      }
    } catch (err) {
      console.warn('Supabase bulk vote failed, using fallback:', err);
    }
  }

  for (let i = 0; i < count; i++) {
    store.votes.push({
      id: `v_bulk_${Date.now()}_${i}`,
      election_id: store.election.id,
      candidate_id: candidate.id,
      voter_identifier: `admin_bulk_${Date.now()}_${i}`,
      vote_type: 'ADMIN',
      created_at: now,
    });
  }

  store.auditLogs.unshift({
    id: `audit_${Date.now()}`,
    admin_id: 'admin',
    action: 'ADD_OFFICIAL_VOTES',
    entity_type: 'CANDIDATE',
    entity_id: candidate.id,
    metadata: { count, candidate_name: candidate.name, timestamp: now },
    created_at: now,
  });

  return true;
}

export async function dbGetAuditLogs() {
  if (!isPlaceholderUrl()) {
    try {
      const supabase = getAdminSupabaseClient();
      const { data: logs } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (logs) return logs;
    } catch (err) {
      console.warn('Supabase audit fetch failed, using fallback:', err);
    }
  }

  return store.auditLogs;
}
