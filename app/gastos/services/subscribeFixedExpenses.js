import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function subscribeFixedExpenses({ user, grupo, periodo, onChange }) {
  const unsubscribers = [];
  let personalEntries = [];
  let sharedEntries = [];

  function emitir() {
    // Deduplicar por id
    const map = new Map();
    [...personalEntries, ...sharedEntries].forEach((e) => map.set(e.id, e));
    onChange(Array.from(map.values()));
  }

  // Personales del usuario
  const qPersonal = query(
    collection(db, "fixed_expense_entries"),
    where("usuario", "==", user.uid),
    where("periodo", "==", periodo),
  );

  unsubscribers.push(
    onSnapshot(qPersonal, (snap) => {
      personalEntries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      emitir();
    }, (err) => console.error("fixed personal error:", err)),
  );

  // Compartidos del grupo
  if (grupo?.id) {
    const qShared = query(
      collection(db, "fixed_expense_entries"),
      where("groupId", "==", grupo.id),
      where("periodo", "==", periodo),
    );

    unsubscribers.push(
      onSnapshot(qShared, (snap) => {
        sharedEntries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        emitir();
      }, (err) => console.error("fixed shared error:", err)),
    );
  }

  return () => unsubscribers.forEach((u) => u());
}