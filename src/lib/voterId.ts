import { cookies } from 'next/headers';

const VOTER_COOKIE_NAME = 'votepro_voter_id';

export async function getOrCreateVoterIdentifier(): Promise<{ voterId: string; isNew: boolean }> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(VOTER_COOKIE_NAME);

  if (existing && existing.value && existing.value.trim().length > 0) {
    return { voterId: existing.value, isNew: false };
  }

  const newVoterId = `vid_${crypto.randomUUID()}`;
  return { voterId: newVoterId, isNew: true };
}

export const VOTER_ID_COOKIE_NAME = VOTER_COOKIE_NAME;
