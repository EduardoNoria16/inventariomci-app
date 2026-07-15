import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAdmJ0hHgLdoqbILpcAmAIMufwrX4rAriI",
  authDomain: "inventario-mci-4e2dd.firebaseapp.com",
  projectId: "inventario-mci-4e2dd",
  storageBucket: "inventario-mci-4e2dd.firebasestorage.app",
  messagingSenderId: "303390122006",
  appId: "1:303390122006:web:189d968fec727e77285537",
  measurementId: "G-S3W15GSQXR"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
