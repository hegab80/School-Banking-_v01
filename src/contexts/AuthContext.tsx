import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';

export type Role = 'student' | 'teacher' | 'vendor';

export interface UserProfile {
  uid: string;
  email: string;
  username: string;
  full_name: string;
  role: Role;
  is_frozen: boolean;
  balance: number;
  created_at: string;
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, loading: true });

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let profileUnsubscribe: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const email = firebaseUser.email?.toLowerCase() || '';
        let userDocRef = doc(db, 'users', firebaseUser.uid);
        
        try {
          const uidSnap = await getDoc(userDocRef);
          
          if (!uidSnap.exists() && email) {
            // Check if user exists by email (pre-created by teacher)
            const emailDocRef = doc(db, 'users', email);
            const emailSnap = await getDoc(emailDocRef);
            
            if (emailSnap.exists()) {
              // Use the pre-created document
              userDocRef = emailDocRef;
            } else {
              // Create new student profile
              const newProfile: UserProfile = {
                uid: firebaseUser.uid,
                email: email,
                username: email.split('@')[0] || 'student',
                full_name: firebaseUser.displayName || 'New Student',
                role: 'student',
                is_frozen: false,
                balance: 0,
                created_at: new Date().toISOString(),
              };
              await setDoc(userDocRef, newProfile);
            }
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }

        // Listen to profile changes
        profileUnsubscribe = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
            setLoading(false);
          }
        });
      } else {
        setProfile(null);
        setLoading(false);
        if (profileUnsubscribe) {
          profileUnsubscribe();
          profileUnsubscribe = null;
        }
      }
    });

    return () => {
      unsubscribe();
      if (profileUnsubscribe) {
        profileUnsubscribe();
      }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
