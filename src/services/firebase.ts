// src/services/firebase.ts
import { initializeApp, cert, ServiceAccount } from "firebase-admin/app";
import { getFirestore, Firestore, FieldValue } from "firebase-admin/firestore";
import * as dotenv from "dotenv";

dotenv.config();

export let db: Firestore;

export interface User {
  userId: string;
  username: string;
  firstName: string;
  email?: string;
  startDate: string;
  isActive: boolean;
  currentDay: number;
  completedLessons?: number[];
  lastActivity?: string;
  login?: string;
  createdAt: string;
}

// =================== SESSION STORAGE ===================

export class FirestoreSessionStorage<T> {
  private getCollection() {
    if (!db) {
      throw new Error(
        "Firestore not initialized. Call initializeFirebase() first.",
      );
    }
    return db.collection("bot_sessions");
  }

  async read(key: string): Promise<T | undefined> {
    try {
      const doc = await this.getCollection().doc(key).get();
      if (!doc.exists) return undefined;

      const data = doc.data();
      if (data) {
        delete data.updatedAt;
      }
      return data as T;
    } catch (error) {
      console.error(`Session read error for ${key}:`, error);
      return undefined;
    }
  }

  async write(key: string, value: T): Promise<void> {
    try {
      await this.getCollection()
        .doc(key)
        .set(
          {
            ...value,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
    } catch (error) {
      console.error(`Session write error for ${key}:`, error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.getCollection().doc(key).delete();
    } catch (error) {
      console.error(`Session delete error for ${key}:`, error);
    }
  }
}

// =================== FIREBASE INITIALIZATION ===================

export async function initializeFirebase() {
  try {
    // Парсимо service account з .env
    const serviceAccount = JSON.parse(
      process.env.FIREBASE_SERVICE_ACCOUNT || "{}",
    );

    initializeApp({
      credential: cert(serviceAccount as ServiceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });

    db = getFirestore();
    console.log("✅ Firebase connected successfully");
    console.log("✅ Session storage ready (Firestore)");
  } catch (error) {
    console.error("Firebase initialization error:", error);
    throw error;
  }
}

export async function saveUser(user: User) {
  try {
    const docRef = db.collection("theoko_telegram_users").doc(user.userId);
    const doc = await docRef.get();

    if (!doc.exists) {
      await docRef.set({
        ...user,
        createdAt: FieldValue.serverTimestamp(),
        lastActivity: FieldValue.serverTimestamp(),
      });
      console.log(`New user saved: ${user.userId}`);
    } else {
      await docRef.update({
        lastActivity: FieldValue.serverTimestamp(),
        isActive: true,
      });
      console.log(`User updated: ${user.userId}`);
    }
  } catch (error) {
    console.error("Error saving user:", error);
    throw error;
  }
}

export async function getUser(userId: string): Promise<User | null> {
  try {
    const doc = await db.collection("theoko_telegram_users").doc(userId).get();
    if (!doc.exists) {
      return null;
    }
    return doc.data() as User;
  } catch (error) {
    console.error("Error getting user:", error);
    return null;
  }
}

export async function getUsers(): Promise<User[]> {
  try {
    const snapshot = await db.collection("theoko_telegram_users").get();
    return snapshot.docs.map((doc) => doc.data() as User);
  } catch (error) {
    console.error("Error getting users:", error);
    return [];
  }
}

export async function getActiveUsers(): Promise<User[]> {
  try {
    const snapshot = await db
      .collection("theoko_telegram_users")
      .where("isActive", "==", true)
      .get();

    return snapshot.docs.map((doc) => doc.data() as User);
  } catch (error) {
    console.error("Error getting active users:", error);
    return [];
  }
}

export async function getActiveOrders(): Promise<User[]> {
  try {
    const snapshot = await db.collection("orders").get();
    return snapshot.docs.map((doc) => doc.data() as User);
  } catch (error) {
    console.error("Error getting active users:", error);
    return [];
  }
}

export async function getActivePotentialOrders(): Promise<User[]> {
  try {
    const snapshot = await db.collection("potential_orders").get();
    return snapshot.docs.map((doc) => doc.data() as User);
  } catch (error) {
    console.error("Error getting active users:", error);
    return [];
  }
}

export async function updateUserProgress(userId: string, lessonNumber: number) {
  try {
    await db
      .collection("theoko_telegram_users")
      .doc(userId)
      .update({
        currentDay: lessonNumber,
        completedLessons: FieldValue.arrayUnion(lessonNumber),
        lastActivity: FieldValue.serverTimestamp(),
      });
  } catch (error) {
    console.error("Error updating user progress:", error);
  }
}

export async function deactivateUser(userId: string) {
  try {
    await db.collection("theoko_telegram_users").doc(userId).update({
      isActive: false,
      deactivatedAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error("Error deactivating user:", error);
  }
}

// Функція для збереження історії розсилок
export async function saveBroadcast(broadcast: {
  adminId: string;
  message: string;
  type: string;
  recipients: string[];
  sentAt: string;
}) {
  try {
    await db.collection("broadcasts").add({
      ...broadcast,
      createdAt: FieldValue.serverTimestamp(),
    });
    console.log("Broadcast saved to history");
  } catch (error) {
    console.error("Error saving broadcast:", error);
  }
}

// Функція для отримання статистики
export async function getStats() {
  try {
    const users = await getUsers();
    const activeUsers = users.filter((u) => u.isActive);
    const completionRates = users.map((u) => u.completedLessons?.length || 0);

    return {
      totalUsers: users.length,
      activeUsers: activeUsers.length,
      avgProgress: completionRates.reduce((a, b) => a + b, 0) / users.length,
      maxProgress: Math.max(...completionRates),
      minProgress: Math.min(...completionRates),
    };
  } catch (error) {
    console.error("Error getting stats:", error);
    return null;
  }
}

// =================== SESSION CLEANUP ===================

// Функція для очищення старих сесій (викликай в cron job)
export async function cleanupOldSessions(daysOld: number = 30) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const snapshot = await db
      .collection("bot_sessions")
      .where("updatedAt", "<", FieldValue.serverTimestamp())
      .get();

    let deletedCount = 0;
    const batch = db.batch();

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      const updatedAt = data.updatedAt?.toDate();

      if (updatedAt && updatedAt < cutoffDate) {
        batch.delete(doc.ref);
        deletedCount++;
      }
    });

    if (deletedCount > 0) {
      await batch.commit();
      console.log(`🗑️ Cleaned up ${deletedCount} old sessions`);
    }

    return deletedCount;
  } catch (error) {
    console.error("Error cleaning old sessions:", error);
    return 0;
  }
}
