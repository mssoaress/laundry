import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { app } from "./repository";
const auth = getAuth(app);
export type SessionUser = Pick<User, "uid" | "email">;
export const watchUser = (next: (user: SessionUser | null) => void) =>
  onAuthStateChanged(auth, next);
export async function signIn(email: string, password: string) {
  await signInWithEmailAndPassword(auth, email.trim(), password);
}
export const signOut = () => firebaseSignOut(auth);
