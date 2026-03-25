import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, auth } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { transferFunds, handleFirestoreError, OperationType } from '../services/bankingService';
import { ArrowUpRight, ArrowDownRight, Send, Wallet, Clock } from 'lucide-react';
import { format } from 'date-fns';

export default function Dashboard() {
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  
  const [transferTo, setTransferTo] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!profile) return;

    // Fetch users for the transfer dropdown
    const fetchUsers = async () => {
      try {
        const q = query(collection(db, 'users'), where('role', 'in', ['student', 'teacher', 'vendor']));
        const querySnapshot = await getDocs(q);
        const usersList = querySnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(u => u.id !== profile.uid);
        setUsers(usersList);
      } catch (err) {
        console.error("Error fetching users", err);
      }
    };
    fetchUsers();

    // Listen to transactions
    const q1 = query(collection(db, 'transactions'), where('from_user_id', '==', profile.uid));
    const q2 = query(collection(db, 'transactions'), where('to_user_id', '==', profile.uid));

    const unsub1 = onSnapshot(q1, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      updateTransactions(txs, 'sent');
    }, (err) => handleFirestoreError(err, OperationType.GET, 'transactions', auth));

    const unsub2 = onSnapshot(q2, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      updateTransactions(txs, 'received');
    }, (err) => handleFirestoreError(err, OperationType.GET, 'transactions', auth));

    let allTxs: any[] = [];
    const updateTransactions = (newTxs: any[], type: 'sent' | 'received') => {
      allTxs = [...allTxs.filter(t => 
        type === 'sent' ? t.from_user_id !== profile.uid : t.to_user_id !== profile.uid
      ), ...newTxs];
      
      // Sort by date descending
      allTxs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setTransactions([...allTxs]);
    };

    return () => {
      unsub1();
      unsub2();
    };
  }, [profile]);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (!profile) throw new Error("Not authenticated");
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) throw new Error("Invalid amount");
      if (!transferTo) throw new Error("Select a recipient");
      if (!description) throw new Error("Enter a description");

      await transferFunds(profile.uid, transferTo, numAmount, description, auth);
      
      setSuccess('Transfer successful!');
      setAmount('');
      setDescription('');
      setTransferTo('');
    } catch (err: any) {
      let errorMessage = err.message || "Transfer failed";
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
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Balance Card */}
        <div className="bg-teal-700 rounded-2xl p-6 text-white shadow-lg flex flex-col justify-between">
          <div>
            <p className="text-teal-100 font-medium flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Current Balance
            </p>
            <h2 className="text-4xl font-bold mt-2">{profile.balance.toFixed(2)} <span className="text-xl font-normal text-teal-200">EGP</span></h2>
          </div>
          <div className="mt-6 pt-6 border-t border-teal-600/50">
            <p className="text-sm text-teal-100">Account Status: {profile.is_frozen ? <span className="text-red-300 font-bold">Frozen</span> : <span className="text-teal-200">Active</span>}</p>
          </div>
        </div>

        {/* Transfer Form */}
        <div className="md:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Send className="w-5 h-5 text-teal-600" />
            Send EGP
          </h3>
          
          {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
          {success && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">{success}</div>}
          
          <form onSubmit={handleTransfer} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recipient</label>
                <select 
                  value={transferTo} 
                  onChange={(e) => setTransferTo(e.target.value)}
                  className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  required
                  disabled={profile.is_frozen}
                >
                  <option value="">Select a recipient...</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name} (@{u.username}) {u.role === 'vendor' ? '(Vendor)' : u.role === 'teacher' ? '(Teacher)' : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (EGP)</label>
                <input 
                  type="number" 
                  min="1" 
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  placeholder="0.00"
                  required
                  disabled={profile.is_frozen}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">What's it for?</label>
              <input 
                type="text" 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                placeholder="e.g. Study help, Lunch..."
                maxLength={100}
                required
                disabled={profile.is_frozen}
              />
            </div>
            <div className="flex justify-end">
              <button 
                type="submit" 
                disabled={loading || profile.is_frozen}
                className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? 'Sending...' : 'Send Funds'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-teal-600" />
          Recent Transactions
        </h3>
        
        {transactions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No transactions yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-sm text-gray-500">
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium">Description</th>
                  <th className="pb-3 font-medium">Type</th>
                  <th className="pb-3 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {transactions.map(tx => {
                  const isReceived = tx.to_user_id === profile.uid;
                  return (
                    <tr key={tx.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="py-3 text-gray-600">
                        {format(new Date(tx.created_at), 'MMM d, yyyy h:mm a')}
                      </td>
                      <td className="py-3 font-medium text-gray-800">{tx.description}</td>
                      <td className="py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 capitalize">
                          {tx.type}
                        </span>
                      </td>
                      <td className={`py-3 text-right font-bold flex items-center justify-end gap-1 ${isReceived ? 'text-green-600' : 'text-gray-900'}`}>
                        {isReceived ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4 text-red-500" />}
                        {isReceived ? '+' : '-'}{tx.amount.toFixed(2)} EGP
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
