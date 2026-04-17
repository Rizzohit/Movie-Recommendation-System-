import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot 
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Recommendation, OperationType, FirestoreErrorInfo } from '../types';
import { Sparkles, Calendar, Tv } from 'lucide-react';
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

export default function RecommendationList() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    const path = `users/${auth.currentUser.uid}/recommendations`;
    const q = query(
      collection(db, path),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: Recommendation[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as Recommendation);
      });
      setRecommendations(items);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, []);

  if (loading) return null;

  return (
    <div className="space-y-6">
      <AnimatePresence mode="popLayout">
        {recommendations.map((rec, index) => (
          <motion.div
            key={rec.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="editorial-card grid grid-cols-[100px_1fr_auto] gap-8 items-center"
          >
            <div className="editorial-serif text-2xl text-editorial-paper/60">
              {rec.year}
            </div>
            
            <div className="space-y-2">
              <h3 className="editorial-serif text-3xl font-normal text-editorial-paper">
                {rec.title}
              </h3>
              <p className="text-sm text-editorial-muted leading-relaxed max-w-xl">
                {rec.matchReason}
              </p>
            </div>

            <div className="text-right">
              <span className="inline-block px-4 py-2 border border-editorial-paper text-[10px] uppercase tracking-widest hover:bg-editorial-paper hover:text-editorial-bg transition-colors cursor-pointer">
                {rec.platform}
              </span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      
      {recommendations.length === 0 && (
        <div className="py-20 text-center border-t editorial-border">
          <p className="editorial-serif text-xl text-editorial-muted">No recommendations curated yet.</p>
        </div>
      )}
    </div>
  );
}
