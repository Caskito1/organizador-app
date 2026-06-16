import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export function subscribePersonalExpenses(
  userId,
  month,
  callback,
  onError,
) {
  const q = query(
    collection(
      db,
      "fixed_expenses",
    ),
    where(
      "usuario",
      "==",
      userId,
    ),
    where(
      "compartido",
      "==",
      false,
    ),
    where(
      "fecha",
      "==",
      month,
    ),
  );

  return onSnapshot(
    q,
    (snap) => {
      callback(
        snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })),
      );
    },
    onError,
  );
}

export function subscribeSharedExpenses(
  groupId,
  month,
  callback,
  onError,
) {
  const q = query(
    collection(
      db,
      "fixed_expenses",
    ),
    where(
      "groupId",
      "==",
      groupId,
    ),
    where(
      "compartido",
      "==",
      true,
    ),
    where(
      "fecha",
      "==",
      month,
    ),
  );

  return onSnapshot(
    q,
    (snap) => {
      callback(
        snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })),
      );
    },
    onError,
  );
}

export async function updateExpense(
  expenseId,
  payload,
) {
  const ref = doc(
    db,
    "fixed_expenses",
    expenseId,
  );

  await updateDoc(
    ref,
    payload,
  );
}