'use client';

import { useEffect } from 'react';
import { initFlasher } from '@/lib/flasher';

export function FlasherInit() {
  useEffect(() => {
    return initFlasher();
  }, []);

  return null;
}
