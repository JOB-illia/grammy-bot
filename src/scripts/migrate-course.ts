// src/scripts/migrate-course.ts
import { initializeFirebase, db } from "../services/firebase";
import { loadCourse } from "../services/courseLoader";
import * as fs from "fs/promises";
import * as path from "path";

interface MigrationMap {
  [oldIndex: number]: number;
}

async function createMigrationMap(): Promise<MigrationMap> {
  // Завантажуємо старий курс
  const oldCoursePath = path.join(process.cwd(), "data", "course.json.backup");
  const oldCourseData = await fs.readFile(oldCoursePath, "utf-8");
  const oldCourse = JSON.parse(oldCourseData);

  // Завантажуємо новий курс
  const newCourse = await loadCourse();

  const migrationMap: MigrationMap = {};

  // Створюємо мапу на основі унікальних ідентифікаторів уроків
  // (використовуємо title + type як унікальний ключ)
  oldCourse.lessons.forEach((oldLesson: any, oldIndex: number) => {
    const key = `${oldLesson.title}_${oldLesson.type}`;

    // Шукаємо відповідний урок в новому курсі
    const newIndex = newCourse.findIndex(
      (newLesson) => `${newLesson.title}_${newLesson.type}` === key,
    );

    if (newIndex !== -1) {
      migrationMap[oldIndex] = newIndex;
      console.log(
        `Lesson "${oldLesson.title}" moved from ${oldIndex} to ${newIndex}`,
      );
    } else {
      console.warn(
        `⚠️ Lesson "${oldLesson.title}" at index ${oldIndex} not found in new course`,
      );
    }
  });

  return migrationMap;
}

async function migrateUserProgress() {
  await initializeFirebase();

  // Створюємо бекап перед міграцією
  const backupDate = new Date().toISOString().replace(/[:.]/g, "-");
  console.log(`Creating backup: users_backup_${backupDate}`);

  // Отримуємо мапу міграції
  const migrationMap = await createMigrationMap();

  // Оновлюємо користувачів
  const usersSnapshot = await db.collection("theoko_telegram_users").get();

  let migratedCount = 0;
  const batch = db.batch();

  for (const doc of usersSnapshot.docs) {
    const userData = doc.data();
    const oldProgress = userData.currentDay || 0;
    const oldCompleted = userData.completedLessons || [];

    // Створюємо бекап користувача
    await db.collection(`users_backup_${backupDate}`).doc(doc.id).set(userData);

    // Мігруємо currentDay
    const newProgress = migrationMap[oldProgress] ?? oldProgress;

    // Мігруємо completedLessons
    const newCompleted = oldCompleted
      .map((oldIndex: number) => migrationMap[oldIndex])
      .filter((index: number | undefined) => index !== undefined);

    // Оновлюємо дані
    batch.update(doc.ref, {
      currentDay: newProgress,
      completedLessons: newCompleted,
      migrationDate: new Date().toISOString(),
      previousProgress: oldProgress,
      previousCompleted: oldCompleted,
    });

    migratedCount++;
    console.log(`Migrated user ${doc.id}: ${oldProgress} -> ${newProgress}`);
  }

  // Оновлюємо сесії
  const sessionsSnapshot = await db.collection("bot_sessions").get();

  for (const doc of sessionsSnapshot.docs) {
    const sessionData = doc.data();
    const oldLessonIndex = sessionData.currentLessonIndex || 0;
    const oldCompleted = sessionData.completedLessons || [];

    // Створюємо бекап сесії
    await db
      .collection(`sessions_backup_${backupDate}`)
      .doc(doc.id)
      .set(sessionData);

    const newLessonIndex = migrationMap[oldLessonIndex] ?? oldLessonIndex;
    const newCompleted = oldCompleted
      .map((oldIndex: number) => migrationMap[oldIndex])
      .filter((index: number | undefined) => index !== undefined);

    batch.update(doc.ref, {
      currentLessonIndex: newLessonIndex,
      currentDay: newLessonIndex,
      completedLessons: newCompleted,
      migrationDate: new Date().toISOString(),
    });

    console.log(
      `Migrated session ${doc.id}: ${oldLessonIndex} -> ${newLessonIndex}`,
    );
  }

  await batch.commit();
  console.log(`✅ Migration completed! ${migratedCount} users migrated.`);
  console.log(
    `Backup created in collections: users_backup_${backupDate}, sessions_backup_${backupDate}`,
  );
}

// Команда для відкату міграції
async function rollbackMigration(backupDate: string) {
  await initializeFirebase();

  console.log(`Rolling back to backup: ${backupDate}`);

  // Відновлюємо користувачів
  const backupSnapshot = await db
    .collection(`users_backup_${backupDate}`)
    .get();
  const batch = db.batch();

  for (const doc of backupSnapshot.docs) {
    const backupData = doc.data();
    const userRef = db.collection("theoko_telegram_users").doc(doc.id);
    batch.set(userRef, backupData);
  }

  // Відновлюємо сесії
  const sessionsBackup = await db
    .collection(`sessions_backup_${backupDate}`)
    .get();

  for (const doc of sessionsBackup.docs) {
    const backupData = doc.data();
    const sessionRef = db.collection("bot_sessions").doc(doc.id);
    batch.set(sessionRef, backupData);
  }

  await batch.commit();
  console.log("✅ Rollback completed!");
}

if (require.main === module) {
  const command = process.argv[2];

  if (command === "rollback") {
    const backupDate = process.argv[3];
    if (!backupDate) {
      console.error(
        "Please provide backup date: npm run rollback 2024-01-01T12-00-00-000Z",
      );
      process.exit(1);
    }

    rollbackMigration(backupDate).catch(console.error);
  } else {
    migrateUserProgress().catch(console.error);
  }
}
