import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, doc, updateDoc, increment, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyCQep255-FH2oG6aIbIhmx5xpW2eWv3xmc",
  authDomain: "odparovac.firebaseapp.com",
  projectId: "odparovac",
  storageBucket: "odparovac.firebasestorage.app",
  messagingSenderId: "464279702160",
  appId: "1:464279702160:web:4068b35f32630b47666615"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const SYNC_INTERVAL = 30 * 60 * 1000;

chrome.runtime.onInstalled.addListener(async () => {
  const { enabled, totalCount, globalCount, lastSync, pendingCount } = await chrome.storage.local.get(['enabled', 'totalCount', 'globalCount', 'lastSync', 'pendingCount']);
  
  if (enabled === undefined) await chrome.storage.local.set({ enabled: true });
  if (totalCount === undefined) await chrome.storage.local.set({ totalCount: 0 });
  if (globalCount === undefined) await chrome.storage.local.set({ globalCount: 0 });
  if (pendingCount === undefined) await chrome.storage.local.set({ pendingCount: 0 });
  if (lastSync === undefined) await chrome.storage.local.set({ lastSync: Date.now() });
  
  fetchGlobalCount();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'incrementCounters') {
    handleCounterIncrement(message.count, sender.tab.id);
  }
});

async function handleCounterIncrement(count, tabId) {
  const { totalCount = 0, pendingCount = 0 } = await chrome.storage.local.get(['totalCount', 'pendingCount']);
  
  const newTotal = totalCount + count;
  const newPending = pendingCount + count;
  
  await chrome.storage.local.set({ 
    totalCount: newTotal, 
    pendingCount: newPending 
  });
  
  checkAndSyncGlobal();
}

async function checkAndSyncGlobal() {
  const { lastSync = 0, pendingCount = 0 } = await chrome.storage.local.get(['lastSync', 'pendingCount']);
  const now = Date.now();
  
  if (now - lastSync >= SYNC_INTERVAL && pendingCount > 0) {
    await syncToGlobal(pendingCount);
  }
}

async function syncToGlobal(count) {
  try {
    const docRef = doc(db, 'stats', 'global');
    await updateDoc(docRef, {
      counter: increment(count)
    });
    
    const docSnap = await getDoc(docRef);
    const newGlobal = docSnap.data().counter;
    
    await chrome.storage.local.set({
      globalCount: newGlobal,
      pendingCount: 0,
      lastSync: Date.now()
    });
  } catch (error) {
    console.error('Failed to sync global counter:', error);
  }
}

async function fetchGlobalCount() {
  try {
    const docRef = doc(db, 'stats', 'global');
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      await chrome.storage.local.set({ globalCount: docSnap.data().counter });
    }
  } catch (error) {
    console.error('Failed to fetch global count:', error);
  }
}

setInterval(checkAndSyncGlobal, 5 * 60 * 1000);