import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyB5hq14cxNFp29FAC36hGW2diZVkY9ONzg",
  authDomain: "healthmate-01.firebaseapp.com",
  databaseURL: "https://healthmate-01-default-rtdb.firebaseio.com",
  projectId: "healthmate-01",
  storageBucket: "healthmate-01.appspot.com",
  messagingSenderId: "24883277407",
  appId: "1:24883277407:web:ccbfea7dc7f94a73d1b5ea",

};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const storage = getStorage(app);

export { auth, db }; 
export {storage};