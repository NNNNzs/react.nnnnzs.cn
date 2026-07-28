'use client';

import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import { CrossTabLeaderCoordinator } from '@/lib/cross-tab-leader-coordinator';

export function useCrossTabLeader<TMessage>(
  namespace: string,
  onMessage: (message: TMessage) => void,
  yieldWhenHidden = false,
) {
  const [isLeader, setIsLeader] = useState(false);
  const coordinatorRef = useRef<CrossTabLeaderCoordinator<TMessage> | null>(null);
  const onMessageEvent = useEffectEvent(onMessage);

  useEffect(() => {
    const coordinator = new CrossTabLeaderCoordinator<TMessage>(namespace, {
      onLeaderChange: setIsLeader,
      onMessage: (message) => onMessageEvent(message),
    }, { yieldWhenHidden });
    coordinatorRef.current = coordinator;
    coordinator.start();
    return () => {
      coordinator.stop();
      if (coordinatorRef.current === coordinator) coordinatorRef.current = null;
    };
  }, [namespace, yieldWhenHidden]);

  return {
    isLeader,
    broadcast: useCallback((message: TMessage) => {
      coordinatorRef.current?.broadcast(message);
    }, []),
  };
}
