import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDleTdgPI0bvoVN4DYNd6J5yZ9DU15dIn4",
  authDomain: "lavanderia-emanoel.firebaseapp.com",
  projectId: "lavanderia-emanoel",
  storageBucket: "lavanderia-emanoel.firebasestorage.app",
  messagingSenderId: "165346573574",
  appId: "1:165346573574:web:2380641264cd502ccb7287"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

export const ROLES = {
  'admin@lavanderia.com':       { role: 'admin',       nome: 'Admin' },
  'funcionario@lavanderia.com': { role: 'funcionario', nome: 'Funcionario' },
};

export const LAVADOS_INICIAIS = [
  { id: 'lv1', nome: 'Marmorizado',     valor: 3.50 },
  { id: 'lv2', nome: 'Destroyed',       valor: 3.00 },
  { id: 'lv3', nome: 'Hiper Destroyed', valor: 3.30 },
  { id: 'lv4', nome: 'Amaciado',        valor: 1.50 },
  { id: 'lv5', nome: 'Engomado',        valor: 2.00 },
];
