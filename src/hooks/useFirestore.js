import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db, LAVADOS_INICIAIS } from '../lib/firebase';
import { gerarId } from '../lib/helpers';

export function useFirestore() {
  const [clientes,    setClientes]    = useState([]);
  const [lancamentos, setLancamentos] = useState([]);
  const [pagamentos,  setPagamentos]  = useState([]);
  const [lavados,     setLavados]     = useState([]);
  const [ready,       setReady]       = useState(false);

  useEffect(() => {
    let counts = { c: false, l: false, p: false, lv: false };
    const check = () => {
      if (Object.values(counts).every(Boolean)) setReady(true);
    };

    // Migração inicial de lavados
    getDocs(collection(db, 'lavados')).then(snap => {
      if (snap.empty) {
        const batch = writeBatch(db);
        LAVADOS_INICIAIS.forEach(lv => batch.set(doc(db, 'lavados', lv.id), lv));
        batch.commit();
      }
    });

    const u1 = onSnapshot(collection(db, 'clientes'),    s => { setClientes(s.docs.map(d => ({...d.data(), id: d.id}))); counts.c  = true; check(); });
    const u2 = onSnapshot(collection(db, 'lancamentos'), s => { setLancamentos(s.docs.map(d => ({...d.data(), id: d.id}))); counts.l  = true; check(); });
    const u3 = onSnapshot(collection(db, 'pagamentos'),  s => { setPagamentos(s.docs.map(d => ({...d.data(), id: d.id}))); counts.p  = true; check(); });
    const u4 = onSnapshot(collection(db, 'lavados'),     s => { setLavados(s.docs.map(d => ({...d.data(), id: d.id}))); counts.lv = true; check(); });

    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  const salvarDoc = async (col, id, dados) => setDoc(doc(db, col, id), dados);
  const deletarDoc = async (col, id) => deleteDoc(doc(db, col, id));

  return { clientes, lancamentos, pagamentos, lavados, ready, salvarDoc, deletarDoc, gerarId };
}
