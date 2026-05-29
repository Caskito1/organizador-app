"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { useAuth } from "./AuthContext";

const GroupContext = createContext(null);

export function GroupProvider({ children }) {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(true);

  useEffect(() => {
    if (!user) {
      setGroups([]);
      setLoadingGroups(false);
      return;
    }

    async function fetchGroups() {
      try {
        const q = query(
          collection(db, "groups"),
          where("members", "array-contains", user.uid)
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setGroups(data);
      } catch (e) {
        console.error("Error cargando grupos:", e);
      } finally {
        setLoadingGroups(false);
      }
    }

    fetchGroups();
  }, [user]);

  return (
    <GroupContext.Provider value={{ groups, loadingGroups }}>
      {children}
    </GroupContext.Provider>
  );
}

export function useGroups() {
  return useContext(GroupContext);
}