import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut, User, linkWithPopup } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { setCachedAccessToken, initializeGmailAuthListener } from './gmail';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId); /* CRITICAL: The app will break without this line */
export const auth = getAuth(app);

// Initialize Gmail Auth listener to clear cache on sign out
initializeGmailAuthListener(auth);

// Test connection on startup as required by firebase-integration skill
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('the client is offline')) {
        console.warn("Please check your Firebase configuration. Detail: Client is offline / Firestore disconnected.");
      } else {
        console.warn("Firebase startup connection check details:", error.message);
      }
    } else {
      console.warn("Firebase startup connection check failed with non-Error object:", error);
    }
  }
}
testConnection();

// Auto sign-in anonymously if not signed in, so we have a persistent secure ID
export function ensureUserSignedIn(onUserReady: (user: User | null) => void) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      onUserReady(user);
    } else {
      try {
        const credential = await signInAnonymously(auth);
        if (credential.user) {
          onUserReady(credential.user);
        }
      } catch (err) {
        console.warn("Anonymous login is disabled or restricted in Firebase console. Operating in local-first/Google Auth mode. API says:", err);
        // Call with null to gracefully fallback to localStorage/seed offline data
        onUserReady(null);
      }
    }
  });
}

let preAuthHook: ((reason: string) => void) | null = null;
export function registerPreAuthHook(fn: (reason: string) => void) {
  preAuthHook = fn;
}

export function googleSignIn() {
  if (preAuthHook) {
    try {
      preAuthHook('Vóór Google Inloggen');
    } catch (e) {
      console.warn('Pre-auth hook error:', e);
    }
  }

  const provider = new GoogleAuthProvider();
  // Request Gmail scopes implicitly
  provider.addScope('https://www.googleapis.com/auth/gmail.send');
  
  const currentUser = auth.currentUser;
  if (currentUser && currentUser.isAnonymous) {
    console.log('Linking anonymous user to Google account on explicit sign in');
    return linkWithPopup(currentUser, provider).then((result) => {
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setCachedAccessToken(credential.accessToken);
      }
      return result;
    }).catch((linkErr) => {
      console.warn('linkWithPopup failed on sign in, falling back to signInWithPopup:', linkErr);
      return signInWithPopup(auth, provider).then((result) => {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          setCachedAccessToken(credential.accessToken);
        }
        return result;
      });
    });
  }

  return signInWithPopup(auth, provider).then((result) => {
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      setCachedAccessToken(credential.accessToken);
    }
    return result;
  });
}

export function googleSignOut() {
  if (preAuthHook) {
    try {
      preAuthHook('Vóór Google Uitloggen');
    } catch (e) {
      console.warn('Pre-auth hook error on signout:', e);
    }
  }
  setCachedAccessToken(null);
  return signOut(auth);
}
