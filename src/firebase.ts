import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: "AIzaSyBS0CfD-D8mfkhk_THpAz_RTAAlsLUKzS0",
  authDomain: "myspace-469c9.firebaseapp.com",
  projectId: "myspace-469c9",
  storageBucket: "myspace-469c9.firebasestorage.app",
  messagingSenderId: "57148730885",
  appId: "1:57148730885:web:15b858d745de98661c366c",
  measurementId: "G-F2YCMB3MMV"
};

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const firestore = getFirestore(app)
export const storage = getStorage(app)
