import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { appEnv } from "@/config/env";

const firebaseConfig = {
  apiKey: appEnv.firebase.apiKey,
  authDomain: appEnv.firebase.authDomain,
  projectId: appEnv.firebase.projectId,
  storageBucket: appEnv.firebase.storageBucket,
  messagingSenderId: appEnv.firebase.messagingSenderId,
  appId: appEnv.firebase.appId,
  measurementId: appEnv.firebase.measurementId,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
