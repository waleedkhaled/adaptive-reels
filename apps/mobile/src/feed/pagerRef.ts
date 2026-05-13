import { createRef } from 'react';
import type { FlatList } from 'react-native';
import type { FeedSlot } from '../lib/types';

/** The feed pager, so Continue and Later can advance it programmatically. */
export const pagerRef = createRef<FlatList<FeedSlot>>();
