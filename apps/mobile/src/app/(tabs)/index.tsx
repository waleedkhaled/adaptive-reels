import { useEffect } from 'react';
import { Feed } from '../../feed/Feed';
import { resumeProfile } from '../../feed/session';
import { useApp } from '../../lib/store';

export default function FeedScreen() {
  const hasSlots = useApp((s) => s.slots.length > 0);
  const hasLearner = useApp((s) => s.learner !== null);

  // A restored profile starts a fresh feed session (a cold start ends a session: UX.md 3.7).
  useEffect(() => {
    if (!hasSlots && hasLearner) resumeProfile();
  }, [hasSlots, hasLearner]);

  return <Feed />;
}
