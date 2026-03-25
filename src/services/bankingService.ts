import { db } from '../firebase';
import { collection, doc, writeBatch, increment, getDoc, serverTimestamp, query, where, orderBy, getDocs, onSnapshot } from 'firebase/firestore';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

export const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null, auth: any) => {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
};

export const transferFunds = async (fromUserId: string, toUserId: string, amount: number, description: string, auth: any) => {
  if (amount <= 0) throw new Error("Amount must be positive");
  if (fromUserId === toUserId) throw new Error("Cannot transfer to yourself");

  const fromUserRef = doc(db, 'users', fromUserId);
  const toUserRef = doc(db, 'users', toUserId);
  const txRef = doc(collection(db, 'transactions'));

  let fromUserSnap, toUserSnap;
  try {
    fromUserSnap = await getDoc(fromUserRef);
    toUserSnap = await getDoc(toUserRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'users', auth);
    throw error;
  }

  if (!fromUserSnap.exists()) throw new Error("Sender not found");
  
  const fromUserData = fromUserSnap.data();
  if (fromUserData.is_frozen) throw new Error("Your account is frozen");
  if (fromUserData.balance < amount) throw new Error("Insufficient funds");

  if (!toUserSnap.exists()) throw new Error("Recipient not found");
  if (toUserSnap.data().is_frozen) throw new Error("Recipient account is frozen");

  try {
    const batch = writeBatch(db);
    
    // Deduct from sender
    batch.update(fromUserRef, { balance: increment(-amount) });
    
    // Add to receiver
    batch.update(toUserRef, { balance: increment(amount) });
    
    // Record transaction
    batch.set(txRef, {
      from_user_id: fromUserId,
      to_user_id: toUserId,
      amount,
      description,
      type: 'transfer',
      created_at: new Date().toISOString()
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'transactions', auth);
  }
};

export const issueFunds = async (toUserId: string, amount: number, description: string, auth: any) => {
  if (amount <= 0) throw new Error("Amount must be positive");

  const toUserRef = doc(db, 'users', toUserId);
  const txRef = doc(collection(db, 'transactions'));

  try {
    const batch = writeBatch(db);
    
    batch.update(toUserRef, { balance: increment(amount) });
    
    batch.set(txRef, {
      from_user_id: null,
      to_user_id: toUserId,
      amount,
      description,
      type: 'deposit',
      created_at: new Date().toISOString()
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'transactions', auth);
  }
};
