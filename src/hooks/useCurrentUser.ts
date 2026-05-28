import { useEffect, useState } from 'react';
import { getCurrentUser, onAuthChange, type AppUser } from '@/lib/auth';

export function useCurrentUser() {
  const [user, setUser] = useState<AppUser | null>(getCurrentUser);
  useEffect(() => onAuthChange(setUser), []);
  return user;
}
