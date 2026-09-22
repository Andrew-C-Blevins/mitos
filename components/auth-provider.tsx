'use client';
import { Brand } from './brand';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { getFirebase, firebaseConfigured, useEmulators } from '@/lib/data/client/firebase';
import { decode } from '@/lib/data/codec';
import type { UserProfile, Viewer } from '@/lib/types';

interface Session {
  user: User;
  profile: UserProfile;
  viewer: Viewer;
}
const AuthContext = createContext<Session | null>(null);
export function useSession(): Session {
  const session = useContext(AuthContext);
  if (!session) throw new Error('Sign in before using Mitos.');
  return session;
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(firebaseConfigured),
    [error, setError] = useState('');
  useEffect(() => {
    if (!firebaseConfigured) return;
    const { auth, db } = getFirebase();
    let generation = 0;
    let stopProfile: (() => void) | undefined;
    const stop = onAuthStateChanged(auth, async (user) => {
      const current = ++generation;
      stopProfile?.();
      setSession(null);
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const ref = doc(db, 'users', user.uid);
        // Cached profile permits reopening an already-loaded app offline. A first
        // sign-in still requires the authenticated provisioning route.
        let profileDoc = await getDoc(ref);
        if (!profileDoc.exists()) {
          const response = await fetch('/api/session', {
            method: 'POST',
            headers: { Authorization: `Bearer ${await user.getIdToken()}` },
          });
          if (!response.ok) throw new Error((await response.json()).error ?? 'Sign-in failed.');
          profileDoc = await getDoc(ref);
        }
        if (!profileDoc.exists()) throw new Error('Your account is not ready yet.');
        const profile = decode<UserProfile>(user.uid, profileDoc.data());
        if (current === generation) {
          setSession({
            user,
            profile,
            viewer: {
              uid: user.uid,
              personId: profile.personId,
              householdIds: profile.householdIds,
            },
          });
          stopProfile = onSnapshot(
            ref,
            (snapshot) => {
              if (current !== generation || !snapshot.exists()) return;
              setSession((previous) =>
                previous
                  ? {
                      ...previous,
                      profile: decode<UserProfile>(user.uid, snapshot.data()),
                    }
                  : previous,
              );
            },
            (caught) => {
              if (current === generation) setError(caught.message);
            },
          );
        }
      } catch (caught) {
        if (current === generation)
          setError(caught instanceof Error ? caught.message : 'Sign-in failed.');
      } finally {
        if (current === generation) setLoading(false);
      }
    });
    return () => {
      generation++;
      stopProfile?.();
      stop();
    };
  }, []);
  async function login(person?: 'andrew' | 'karen') {
    setError('');
    try {
      const { auth } = getFirebase();
      if (useEmulators && person)
        await signInWithEmailAndPassword(auth, `${person}@mitos.test`, 'local-mitos-only');
      else await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not sign in.');
    }
  }
  if (session)
    return (
      <AuthContext value={session}>
        <div key={session.user.uid}>{children}</div>
      </AuthContext>
    );
  return (
    <main className="sign-in">
      <Brand />
      <h1>A place for what’s next.</h1>
      {loading ? (
        <p role="status">Opening your household…</p>
      ) : !firebaseConfigured ? (
        <p>Local setup is needed. Follow the instructions in README.md.</p>
      ) : (
        <>
          <p>Sign in to your household.</p>
          {useEmulators ? (
            <div className="sign-in-actions">
              <button className="primary-button" onClick={() => login('andrew')}>
                Continue as Andrew
              </button>
              <button onClick={() => login('karen')}>Continue as Karen</button>
              <small>Local design preview</small>
            </div>
          ) : (
            <button className="primary-button" onClick={() => login()}>
              Continue with Google
            </button>
          )}
        </>
      )}
      {error ? <p role="alert">{error}</p> : null}
    </main>
  );
}
export function logout() {
  return signOut(getFirebase().auth);
}
