import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { HistoryItem, OperationType, FirestoreErrorInfo } from '../types';
import { Plus, Trash2, Search, Clapperboard, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
};

export default function HistoryManager() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newContent, setNewContent] = useState('');
  const [source, setSource] = useState<'OTT' | 'SEARCH'>('SEARCH');

  useEffect(() => {
    if (!auth.currentUser) return;

    const path = `users/${auth.currentUser.uid}/history`;
    const q = query(
      collection(db, path),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: HistoryItem[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as HistoryItem);
      });
      setHistory(items);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, []);

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim() || !auth.currentUser) return;

    const path = `users/${auth.currentUser.uid}/history`;
    try {
      await addDoc(collection(db, path), {
        uid: auth.currentUser.uid,
        source,
        content: newContent.trim(),
        timestamp: new Date().toISOString()
      });
      setNewContent('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const removeItem = async (id: string) => {
    if (!auth.currentUser) return;
    const path = `users/${auth.currentUser.uid}/history/${id}`;
    try {
      await deleteDoc(doc(db, path));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  if (loading) return <div className="p-4 text-white/50 animate-pulse">Loading history...</div>;

  return (
    <div className="space-y-8">
      <form onSubmit={addItem} className="relative">
        <div className="flex flex-col gap-4">
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setSource('SEARCH')}
              className={`editorial-label px-3 py-1 border transition-all ${source === 'SEARCH' ? 'bg-editorial-accent text-black border-editorial-accent' : 'border-editorial-muted text-editorial-muted'}`}
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => setSource('OTT')}
              className={`editorial-label px-3 py-1 border transition-all ${source === 'OTT' ? 'bg-editorial-accent text-black border-editorial-accent' : 'border-editorial-muted text-editorial-muted'}`}
            >
              OTT
            </button>
          </div>
          <div className="flex items-center gap-2 border-b editorial-border pb-2">
            <input
              type="text"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder={source === 'SEARCH' ? "Add search history..." : "Add watched movie..."}
              className="flex-1 bg-transparent border-none outline-none text-editorial-paper placeholder:text-editorial-muted text-sm font-light"
            />
            <button
              type="submit"
              disabled={!newContent.trim()}
              className="text-editorial-accent disabled:opacity-30"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>
      </form>

      <ul className="space-y-4">
        <AnimatePresence mode="popLayout">
          {history.map((item) => (
            <motion.li
              key={item.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              layout
              className="group flex items-start gap-3 text-xs leading-relaxed text-editorial-paper/80 border-l border-editorial-accent/30 pl-3"
            >
              <span className="flex-1">{item.content}</span>
              <button
                onClick={() => removeItem(item.id)}
                className="opacity-0 group-hover:opacity-100 text-editorial-muted hover:text-red-400 transition-all"
              >
                <X size={14} />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
