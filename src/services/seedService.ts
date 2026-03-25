import { db } from '../firebase';
import { doc, writeBatch, collection } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './bankingService';

const SAMPLE_STUDENTS = [
  { uid: 'student_1', email: 'aisha@albashaer.edu', username: 'aisha_a', full_name: 'Aisha Ahmed', role: 'student', is_frozen: false, balance: 150 },
  { uid: 'student_2', email: 'omar@albashaer.edu', username: 'omar_h', full_name: 'Omar Hassan', role: 'student', is_frozen: false, balance: 50 },
  { uid: 'student_3', email: 'youssef@albashaer.edu', username: 'youssef_a', full_name: 'Youssef Ali', role: 'student', is_frozen: false, balance: 200 },
  { uid: 'student_4', email: 'fatima@albashaer.edu', username: 'fatima_m', full_name: 'Fatima Mahmoud', role: 'student', is_frozen: false, balance: 300 },
  { uid: 'student_5', email: 'tariq@albashaer.edu', username: 'tariq_i', full_name: 'Tariq Ibrahim', role: 'student', is_frozen: false, balance: 20 },
  { uid: 'student_6', email: 'salma@albashaer.edu', username: 'salma_k', full_name: 'Salma Khaled', role: 'student', is_frozen: false, balance: 120 },
  { uid: 'student_7', email: 'karim@albashaer.edu', username: 'karim_m', full_name: 'Karim Mostafa', role: 'student', is_frozen: true, balance: 0 },
  { uid: 'student_8', email: 'mariam@albashaer.edu', username: 'mariam_s', full_name: 'Mariam Saeed', role: 'student', is_frozen: false, balance: 500 },
];

const SAMPLE_TEACHERS = [
  { uid: 'teacher_1', email: 'mr.ahmed@albashaer.edu', username: 'mr_ahmed', full_name: 'Mr. Ahmed Yassin', role: 'teacher', is_frozen: false, balance: 0 },
  { uid: 'teacher_2', email: 'ms.nada@albashaer.edu', username: 'ms_nada', full_name: 'Ms. Nada Farouk', role: 'teacher', is_frozen: false, balance: 0 },
];

const SAMPLE_VENDORS = [
  { uid: 'vendor_1', email: 'canteen@albashaer.edu', username: 'canteen', full_name: 'School Canteen', role: 'vendor', is_frozen: false, balance: 0 },
  { uid: 'vendor_2', email: 'cafe@albashaer.edu', username: 'cafe', full_name: 'School Cafe', role: 'vendor', is_frozen: false, balance: 0 },
  { uid: 'vendor_3', email: 'store@albashaer.edu', username: 'store', full_name: 'Stationery Store', role: 'vendor', is_frozen: false, balance: 0 },
];

export const seedDatabase = async (auth: any) => {
  try {
    const batch = writeBatch(db);
    const now = new Date().toISOString();

    // Add users
    [...SAMPLE_STUDENTS, ...SAMPLE_TEACHERS, ...SAMPLE_VENDORS].forEach(user => {
      const userRef = doc(db, 'users', user.uid);
      batch.set(userRef, {
        ...user,
        created_at: now
      });
    });

    // Add some initial transactions
    const txs = [
      { from_user_id: null, to_user_id: 'student_1', amount: 150, description: 'Initial Deposit', type: 'deposit' },
      { from_user_id: null, to_user_id: 'student_2', amount: 50, description: 'Initial Deposit', type: 'deposit' },
      { from_user_id: null, to_user_id: 'student_3', amount: 200, description: 'Initial Deposit', type: 'deposit' },
      { from_user_id: null, to_user_id: 'student_4', amount: 300, description: 'Initial Deposit', type: 'deposit' },
      { from_user_id: null, to_user_id: 'student_5', amount: 20, description: 'Initial Deposit', type: 'deposit' },
      { from_user_id: null, to_user_id: 'student_6', amount: 120, description: 'Initial Deposit', type: 'deposit' },
      { from_user_id: null, to_user_id: 'student_8', amount: 500, description: 'Initial Deposit', type: 'deposit' },
      { from_user_id: 'student_8', to_user_id: 'student_1', amount: 50, description: 'Tutoring', type: 'transfer' },
    ];

    txs.forEach(tx => {
      const txRef = doc(collection(db, 'transactions'));
      batch.set(txRef, {
        ...tx,
        created_at: now
      });
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'users/transactions', auth);
  }
};
