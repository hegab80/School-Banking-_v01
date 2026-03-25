import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, getDocs, writeBatch, increment, setDoc, deleteDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType, issueFunds } from '../services/bankingService';
import { seedDatabase } from '../services/seedService';
import { Users, Search, ShieldAlert, ShieldCheck, DollarSign, Download, Clock, Database, UserPlus, Trash2, Edit2 } from 'lucide-react';
import { format } from 'date-fns';

export default function TeacherPanel() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Issue Funds State
  const [selectedStudent, setSelectedStudent] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Bulk Deposit State
  const [bulkAmount, setBulkAmount] = useState('');
  const [bulkDesc, setBulkDesc] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);

  // Create Account State
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [newStudentUsername, setNewStudentUsername] = useState('');
  const [newAccountRole, setNewAccountRole] = useState('student');
  const [newStudentBalance, setNewStudentBalance] = useState('0');
  const [createLoading, setCreateLoading] = useState(false);

  // View Transactions State
  const [viewingStudent, setViewingStudent] = useState<any>(null);
  const [studentTxs, setStudentTxs] = useState<any[]>([]);

  // Delete Account State
  const [accountToDelete, setAccountToDelete] = useState<any>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Edit Account State
  const [accountToEdit, setAccountToEdit] = useState<any>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editRole, setEditRole] = useState('student');
  const [editBalance, setEditBalance] = useState('0');
  const [editLoading, setEditLoading] = useState(false);

  // Seed State
  const [isSeeding, setIsSeeding] = useState(false);

  useEffect(() => {
    if (profile?.role !== 'teacher') return;

    const q = query(collection(db, 'users'), where('role', 'in', ['student', 'teacher', 'vendor']));
    const unsub = onSnapshot(q, (snapshot) => {
      const usersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersList);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'users', auth));

    return () => unsub();
  }, [profile]);

  const handleSeed = async () => {
    setIsSeeding(true);
    setMessage({ type: '', text: '' });
    try {
      await seedDatabase(auth);
      setMessage({ type: 'success', text: 'Sample data seeded successfully!' });
    } catch (err: any) {
      let errorMessage = err.message || 'Failed to seed data';
      try {
        const parsed = JSON.parse(errorMessage);
        if (parsed.error) {
          errorMessage = parsed.error;
          if (errorMessage.includes("Missing or insufficient permissions")) {
            errorMessage = "You do not have permission to perform this action.";
          }
        }
      } catch (e) {
        // Not JSON, use original message
      }
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleIssueFunds = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    setLoading(true);

    try {
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) throw new Error("Invalid amount");
      if (!selectedStudent) throw new Error("Select a student");
      if (!description) throw new Error("Enter a description");

      await issueFunds(selectedStudent, numAmount, description, auth);
      
      setMessage({ type: 'success', text: 'Funds issued successfully!' });
      setAmount('');
      setDescription('');
      setSelectedStudent('');
    } catch (err: any) {
      let errorMessage = err.message || "Failed to issue funds";
      try {
        const parsed = JSON.parse(errorMessage);
        if (parsed.error) {
          errorMessage = parsed.error;
          if (errorMessage.includes("Missing or insufficient permissions")) {
            errorMessage = "You do not have permission to perform this action.";
          }
        }
      } catch (e) {
        // Not JSON, use original message
      }
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    setBulkLoading(true);

    try {
      const numAmount = parseFloat(bulkAmount);
      if (isNaN(numAmount) || numAmount <= 0) throw new Error("Invalid amount");
      if (!bulkDesc) throw new Error("Enter a description");

      const activeStudents = users.filter(s => !s.is_frozen && s.role === 'student');
      if (activeStudents.length === 0) throw new Error("No active students found");

      // Firestore batch limit is 500, assuming < 500 students for MVP
      const batch = writeBatch(db);
      
      activeStudents.forEach(student => {
        const userRef = doc(db, 'users', student.id);
        const txRef = doc(collection(db, 'transactions'));
        
        batch.update(userRef, { balance: increment(numAmount) });
        batch.set(txRef, {
          from_user_id: null,
          to_user_id: student.id,
          amount: numAmount,
          description: bulkDesc,
          type: 'deposit',
          created_at: new Date().toISOString()
        });
      });

      await batch.commit();
      
      setMessage({ type: 'success', text: `Bulk deposit sent to ${activeStudents.length} students!` });
      setBulkAmount('');
      setBulkDesc('');
    } catch (err: any) {
      let errorMessage = err.message || "Bulk deposit failed";
      try {
        const parsed = JSON.parse(errorMessage);
        if (parsed.error) {
          errorMessage = parsed.error;
          if (errorMessage.includes("Missing or insufficient permissions")) {
            errorMessage = "You do not have permission to perform this action.";
          }
        }
      } catch (e) {
        // Not JSON, use original message
      }
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setBulkLoading(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    setCreateLoading(true);

    try {
      if (!newStudentName || !newStudentEmail || !newStudentUsername) {
        throw new Error("Please fill in all required fields");
      }

      const initialBalance = parseFloat(newStudentBalance) || 0;
      if (initialBalance < 0) throw new Error("Initial balance cannot be negative");

      // Check if email or username already exists
      const emailQuery = query(collection(db, 'users'), where('email', '==', newStudentEmail));
      const emailSnap = await getDocs(emailQuery);
      if (!emailSnap.empty) throw new Error("A user with this email already exists");

      const usernameQuery = query(collection(db, 'users'), where('username', '==', newStudentUsername));
      const usernameSnap = await getDocs(usernameQuery);
      if (!usernameSnap.empty) throw new Error("This username is already taken");

      // Create the new user document
      const newUserId = newStudentEmail.toLowerCase();
      const newDocRef = doc(db, 'users', newUserId);
      
      const batch = writeBatch(db);
      
      batch.set(newDocRef, {
        uid: newUserId,
        email: newStudentEmail,
        username: newStudentUsername,
        full_name: newStudentName,
        role: newAccountRole,
        is_frozen: false,
        balance: initialBalance,
        created_at: new Date().toISOString()
      });

      // If there's an initial balance, create a transaction record
      if (initialBalance > 0) {
        const txRef = doc(collection(db, 'transactions'));
        batch.set(txRef, {
          from_user_id: null,
          to_user_id: newUserId,
          amount: initialBalance,
          description: 'Initial Deposit',
          type: 'deposit',
          created_at: new Date().toISOString()
        });
      }

      await batch.commit();

      setMessage({ type: 'success', text: `Account for ${newStudentName} created successfully!` });
      setNewStudentName('');
      setNewStudentEmail('');
      setNewStudentUsername('');
      setNewAccountRole('student');
      setNewStudentBalance('0');
    } catch (err: any) {
      let errorMessage = err.message || "Failed to create account";
      try {
        const parsed = JSON.parse(errorMessage);
        if (parsed.error) {
          errorMessage = parsed.error;
          if (errorMessage.includes("Missing or insufficient permissions")) {
            errorMessage = "You do not have permission to perform this action.";
          }
        }
      } catch (e) {
        // Not JSON, use original message
      }
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setCreateLoading(false);
    }
  };

  const toggleFreeze = async (studentId: string, currentStatus: boolean) => {
    try {
      const userRef = doc(db, 'users', studentId);
      await updateDoc(userRef, { is_frozen: !currentStatus });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'users', auth);
    }
  };

  const viewTransactions = async (student: any) => {
    setViewingStudent(student);
    try {
      const q1 = query(collection(db, 'transactions'), where('from_user_id', '==', student.id));
      const q2 = query(collection(db, 'transactions'), where('to_user_id', '==', student.id));
      
      const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      
      const txs = [...snap1.docs, ...snap2.docs].map(doc => ({ id: doc.id, ...doc.data() } as any));
      
      // Remove duplicates if any (though shouldn't be possible here) and sort
      const uniqueTxs = Array.from(new Map(txs.map(item => [item.id, item])).values());
      uniqueTxs.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setStudentTxs(uniqueTxs);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'transactions', auth);
    }
  };

  const handleDeleteAccount = async () => {
    if (!accountToDelete) return;
    setDeleteLoading(true);
    try {
      await deleteDoc(doc(db, 'users', accountToDelete.id));
      setMessage({ type: 'success', text: `Account for ${accountToDelete.full_name} deleted successfully.` });
      setAccountToDelete(null);
    } catch (err: any) {
      let errorMessage = err.message || "Failed to delete account";
      try {
        const parsed = JSON.parse(errorMessage);
        if (parsed.error) {
          errorMessage = parsed.error;
          if (errorMessage.includes("Missing or insufficient permissions")) {
            errorMessage = "You do not have permission to delete this account.";
          }
        }
      } catch (e) {
        // Not JSON
      }
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setDeleteLoading(false);
    }
  };

  const openEditModal = (student: any) => {
    setAccountToEdit(student);
    setEditFullName(student.full_name);
    setEditUsername(student.username);
    setEditRole(student.role);
    setEditBalance(student.balance.toString());
  };

  const handleUpdateAccount = async () => {
    if (!accountToEdit) return;
    setEditLoading(true);
    try {
      const userRef = doc(db, 'users', accountToEdit.id);
      await updateDoc(userRef, {
        full_name: editFullName,
        username: editUsername,
        role: editRole,
        balance: parseFloat(editBalance) || 0
      });
      setMessage({ type: 'success', text: `Account for ${editFullName} updated successfully.` });
      setAccountToEdit(null);
    } catch (err: any) {
      let errorMessage = err.message || "Failed to update account";
      try {
        const parsed = JSON.parse(errorMessage);
        if (parsed.error) {
          errorMessage = parsed.error;
          if (errorMessage.includes("Missing or insufficient permissions")) {
            errorMessage = "You do not have permission to update this account.";
          }
        }
      } catch (e) {
        // Not JSON
      }
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setEditLoading(false);
    }
  };

  const filteredUsers = users.filter(s => 
    s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (profile?.role !== 'teacher') {
    return <div className="p-8 text-center text-red-600 font-bold">Access Denied. Teachers only.</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Teacher Panel</h2>
        <button 
          onClick={handleSeed}
          disabled={isSeeding}
          className="flex items-center gap-2 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          <Database className="w-4 h-4" />
          {isSeeding ? 'Seeding...' : 'Seed Sample Data'}
        </button>
      </div>

      {message.text && (
        <div className={`p-4 rounded-lg text-sm font-medium ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Issue Funds Form */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-teal-600" />
            Issue EGP (Single)
          </h3>
          <form onSubmit={handleIssueFunds} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Recipient</label>
              <select 
                value={selectedStudent} 
                onChange={(e) => setSelectedStudent(e.target.value)}
                className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-teal-500 outline-none"
                required
              >
                <option value="">Select an account...</option>
                {users.map(s => (
                  <option key={s.id} value={s.id}>{s.full_name} (@{s.username}) {s.role === 'vendor' ? '(Vendor)' : s.role === 'teacher' ? '(Teacher)' : ''}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input 
                  type="number" min="1" step="1"
                  value={amount} onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-teal-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <input 
                  type="text"
                  value={description} onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-teal-500 outline-none"
                  placeholder="e.g. Good behavior"
                  required
                />
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50">
              {loading ? 'Issuing...' : 'Issue Funds'}
            </button>
          </form>
        </div>

        {/* Bulk Deposit Form */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Download className="w-5 h-5 text-teal-600" />
            Bulk Deposit (All Active)
          </h3>
          <form onSubmit={handleBulkDeposit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount per student</label>
                <input 
                  type="number" min="1" step="1"
                  value={bulkAmount} onChange={(e) => setBulkAmount(e.target.value)}
                  className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-teal-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <input 
                  type="text"
                  value={bulkDesc} onChange={(e) => setBulkDesc(e.target.value)}
                  className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-teal-500 outline-none"
                  placeholder="e.g. Weekly allowance"
                  required
                />
              </div>
            </div>
            <button type="submit" disabled={bulkLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 mt-4">
              {bulkLoading ? 'Processing...' : 'Send Bulk Deposit'}
            </button>
          </form>
        </div>

        {/* Create Account Form */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 md:col-span-2 lg:col-span-1">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-teal-600" />
            Create Account
          </h3>
          <form onSubmit={handleCreateAccount} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
                <select 
                  value={newAccountRole} 
                  onChange={(e) => setNewAccountRole(e.target.value)}
                  className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-teal-500 outline-none"
                >
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="vendor">Vendor (Canteen, Cafe, etc.)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name / Store Name</label>
                <input 
                  type="text"
                  value={newStudentName} onChange={(e) => setNewStudentName(e.target.value)}
                  className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-teal-500 outline-none"
                  placeholder="e.g. Ahmed Ali"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input 
                type="email"
                value={newStudentEmail} onChange={(e) => setNewStudentEmail(e.target.value)}
                className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-teal-500 outline-none"
                placeholder="student@albashaer.edu"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input 
                  type="text"
                  value={newStudentUsername} onChange={(e) => setNewStudentUsername(e.target.value)}
                  className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-teal-500 outline-none"
                  placeholder="ahmed_a"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Initial Balance</label>
                <input 
                  type="number" min="0" step="1"
                  value={newStudentBalance} onChange={(e) => setNewStudentBalance(e.target.value)}
                  className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
            </div>
            <button type="submit" disabled={createLoading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 mt-4">
              {createLoading ? 'Creating...' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>

      {/* Student List */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-teal-600" />
            Accounts Directory
          </h3>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text"
              placeholder="Search accounts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none w-full md:w-64"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-sm text-gray-500">
                <th className="pb-3 font-medium">Name</th>
                <th className="pb-3 font-medium">Username</th>
                <th className="pb-3 font-medium">Role</th>
                <th className="pb-3 font-medium text-right">Balance</th>
                <th className="pb-3 font-medium text-center">Status</th>
                <th className="pb-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {filteredUsers.map(student => (
                <tr key={student.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="py-3 font-medium text-gray-800">{student.full_name}</td>
                  <td className="py-3 text-gray-500">@{student.username}</td>
                  <td className="py-3 text-gray-500 capitalize">{student.role}</td>
                  <td className="py-3 text-right font-bold text-gray-900">{student.balance.toFixed(2)} EGP</td>
                  <td className="py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${student.is_frozen ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {student.is_frozen ? 'Frozen' : 'Active'}
                    </span>
                  </td>
                  <td className="py-3 text-right space-x-2">
                    <button 
                      onClick={() => viewTransactions(student)}
                      className="text-teal-600 hover:text-teal-800 text-xs font-medium px-2 py-1 bg-teal-50 rounded"
                    >
                      History
                    </button>
                    <button 
                      onClick={() => toggleFreeze(student.id, student.is_frozen)}
                      className={`${student.is_frozen ? 'text-green-600 hover:text-green-800 bg-green-50' : 'text-orange-600 hover:text-orange-800 bg-orange-50'} text-xs font-medium px-2 py-1 rounded flex-inline items-center gap-1`}
                    >
                      {student.is_frozen ? <ShieldCheck className="w-3 h-3 inline" /> : <ShieldAlert className="w-3 h-3 inline" />}
                      {student.is_frozen ? 'Unfreeze' : 'Freeze'}
                    </button>
                    <button 
                      onClick={() => openEditModal(student)}
                      className="text-blue-600 hover:text-blue-800 text-xs font-medium px-2 py-1 bg-blue-50 rounded flex-inline items-center gap-1"
                      title="Edit Account"
                    >
                      <Edit2 className="w-3 h-3 inline" />
                    </button>
                    <button 
                      onClick={() => setAccountToDelete(student)}
                      className="text-red-600 hover:text-red-800 text-xs font-medium px-2 py-1 bg-red-50 rounded flex-inline items-center gap-1"
                      title="Delete Account"
                    >
                      <Trash2 className="w-3 h-3 inline" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">No accounts found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction History Modal */}
      {viewingStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] flex flex-col shadow-xl">
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-teal-600" />
                History: {viewingStudent.full_name}
              </h3>
              <button onClick={() => setViewingStudent(null)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>
            
            <div className="overflow-y-auto flex-1 pr-2">
              {studentTxs.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No transactions found.</p>
              ) : (
                <div className="space-y-3">
                  {studentTxs.map(tx => {
                    const isReceived = tx.to_user_id === viewingStudent.id;
                    return (
                      <div key={tx.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <div>
                          <p className="font-medium text-gray-800 text-sm">{tx.description}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {format(new Date(tx.created_at), 'MMM d, yyyy h:mm a')} • <span className="capitalize">{tx.type}</span>
                          </p>
                        </div>
                        <div className={`font-bold ${isReceived ? 'text-green-600' : 'text-gray-900'}`}>
                          {isReceived ? '+' : '-'}{tx.amount.toFixed(2)} EGP
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {accountToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              Delete Account
            </h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete the account for <strong className="text-gray-900">{accountToDelete.full_name}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setAccountToDelete(null)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteAccount}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                disabled={deleteLoading}
              >
                {deleteLoading ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Account Modal */}
      {accountToEdit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-blue-600" />
              Edit Account
            </h3>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input 
                  type="text" 
                  value={editFullName} 
                  onChange={e => setEditFullName(e.target.value)} 
                  className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-teal-500 outline-none" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input 
                  type="text" 
                  value={editUsername} 
                  onChange={e => setEditUsername(e.target.value)} 
                  className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-teal-500 outline-none" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select 
                  value={editRole} 
                  onChange={e => setEditRole(e.target.value)} 
                  className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-teal-500 outline-none"
                >
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="vendor">Vendor</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Balance (EGP)</label>
                <input 
                  type="number" 
                  value={editBalance} 
                  onChange={e => setEditBalance(e.target.value)} 
                  className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-teal-500 outline-none" 
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setAccountToEdit(null)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                disabled={editLoading}
              >
                Cancel
              </button>
              <button 
                onClick={handleUpdateAccount}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                disabled={editLoading}
              >
                {editLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
