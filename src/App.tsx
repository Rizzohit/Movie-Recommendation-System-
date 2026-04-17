import { useState, useEffect } from 'react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  collection, 
  addDoc, 
  getDocs,
  query,
  limit,
  orderBy
} from 'firebase/firestore';
import { auth, db } from './firebase';
import HistoryManager from './components/HistoryManager';
import RecommendationList from './components/RecommendationList';
import { getRecommendations } from './services/geminiService';
import { Sparkles, LogIn, LogOut, Clapperboard, Search, BrainCircuit, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { OperationType, FirestoreErrorInfo } from './types';

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

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [userInput, setUserInput] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        // Ensure user doc exists
        try {
          await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            createdAt: new Date().toISOString()
          }, { merge: true });
        } catch (error) {
          console.error("Error creating user doc:", error);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async () => {
    if (loginLoading) return;
    setLoginLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      // Use select_account to ensure the popup always allows account selection
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
        console.warn("Login context: User closed the authorization popup.");
      } else if (error.code === 'auth/cancelled-popup-request') {
        console.warn("Login context: Previous login prompt was cancelled by a newer request.");
      } else if (error.code === 'auth/popup-blocked') {
        console.error("Login failed: Popup blocked by browser. Please allow popups for this site.");
        alert("Sign-in popup was blocked. Please enable popups in your browser and try again.");
      } else {
        console.error("Login failed:", error.code, error.message);
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const logout = () => signOut(auth);

  const handleGenerate = async () => {
    if (!user || generating) return;
    setGenerating(true);

    try {
      // 1. Fetch history from Firestore
      const historyPath = `users/${user.uid}/history`;
      let historySnap;
      try {
        historySnap = await getDocs(query(collection(db, historyPath), orderBy('timestamp', 'desc'), limit(20)));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, historyPath);
        return;
      }
      
      const searchHistory: string[] = [];
      const ottHistory: string[] = [];

      historySnap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.source === 'SEARCH') searchHistory.push(data.content);
        else ottHistory.push(data.content);
      });

      // 2. Call Gemini
      const recs = await getRecommendations(searchHistory, ottHistory, userInput || "I'm looking for something great to watch.");

      // 3. Save recommendations
      const recsPath = `users/${user.uid}/recommendations`;
      for (const rec of recs) {
        try {
          await addDoc(collection(db, recsPath), {
            ...rec,
            uid: user.uid,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, recsPath);
        }
      }
      
      setUserInput('');
    } catch (error) {
      console.error("Critical error during generation:", error);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0502] flex items-center justify-center">
        <Loader2 className="animate-spin text-amber-500" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-editorial-bg text-editorial-paper flex overflow-hidden font-sans">
      {/* Sidebar: User Context */}
      <aside className="w-[320px] border-r editorial-border p-10 flex flex-col justify-between shrink-0 h-screen overflow-y-auto">
        <div className="space-y-12">
          <div className="editorial-serif text-2xl">Movie Recommendation system</div>
          
          <section className="space-y-8">
            <div>
              <span className="editorial-label block mb-4">Grounding Context</span>
              <HistoryManager />
            </div>

            {user && (
              <div className="pt-8 border-t editorial-border">
                <span className="editorial-label block mb-4">Account</span>
                <div className="flex items-center gap-4">
                  <img src={user.photoURL || ''} alt="" className="w-10 h-10 rounded-full border editorial-border grayscale" referrerPolicy="no-referrer" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.displayName}</p>
                    <button onClick={logout} className="text-[10px] uppercase tracking-wider text-editorial-accent hover:text-white transition-colors">Sign Out</button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="mt-12">
          <span className="editorial-label block mb-4">Immediate Request</span>
          <textarea
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Describe your mood..."
            className="w-full bg-transparent border-none outline-none text-sm editorial-serif p-0 text-editorial-muted placeholder:text-editorial-muted/50 resize-none h-24"
          />
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full mt-4 flex items-center justify-center gap-2 py-3 border border-editorial-paper hover:bg-editorial-paper hover:text-editorial-bg transition-all disabled:opacity-30 disabled:hover:bg-transparent"
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <><Sparkles size={16} /> Generate</>}
          </button>
        </div>
      </aside>

      {/* Main Content: Recommendations */}
      <main className="flex-1 p-20 flex flex-col h-screen overflow-y-auto">
        {!user ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-10">
            <div className="space-y-4">
              <h1 className="editorial-serif text-8xl font-normal leading-none tracking-tighter">
                Curated<br />Experience
              </h1>
              <p className="text-editorial-muted max-w-sm mx-auto text-sm leading-relaxed">
                Synthesizing your viewing history with current curiosities. Elite movie curation powered by Gemini.
              </p>
            </div>
            <button 
              onClick={login}
              disabled={loginLoading}
              className="px-10 py-4 border border-editorial-paper text-sm uppercase tracking-[4px] hover:bg-editorial-paper hover:text-editorial-bg transition-all disabled:opacity-50"
            >
              {loginLoading ? 'Opening...' : 'Sign In'}
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
            <header className="mb-20">
              <h1 className="editorial-serif text-7xl font-normal leading-none mb-6">Curated Selections</h1>
              <p className="text-editorial-muted text-sm leading-relaxed max-w-md">
                Three films defined by your current aesthetic profile, generated through behavioral grounding.
              </p>
            </header>

            <RecommendationList />

            <footer className="mt-auto pt-20 flex justify-between items-end text-editorial-muted">
              <div className="flex gap-10">
                <div className="flex flex-col">
                  <span className="text-editorial-accent font-bold uppercase text-[10px] tracking-widest">Visual Identity</span>
                  <span className="text-xs">Proprietary Match</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-editorial-accent font-bold uppercase text-[10px] tracking-widest">Director Style</span>
                  <span className="text-xs">Context Grounded</span>
                </div>
              </div>
              <div className="text-[10px] uppercase tracking-widest opacity-50">
                System 1.04_GEMINI_PRO
              </div>
            </footer>
          </div>
        )}
      </main>
    </div>
  );
}
