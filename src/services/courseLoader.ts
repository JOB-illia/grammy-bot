// src/services/courseLoader.ts
import * as fs from "fs/promises";
import * as path from "path";
import { Quiz, AssessmentQuiz } from "../types";

export interface MediaItem {
  type: "photo" | "video";
  url?: string;
  path?: string;
}

export interface LessonMedia {
  url?: string;
  path?: string;
  items?: MediaItem[];
}

export interface LessonButton {
  text: string;
  url?: string;
  callback_data?: string;
}

export interface CourseLesson {
  day: number;
  title: string;
  type:
    | "text"
    | "photo"
    | "video"
    | "document"
    | "media_group"
    | "quiz"
    | "assessment_quiz"
    | "documents"
    | "video_note";
  content: string;
  media?: LessonMedia;
  medias?: LessonMedia[];
  buttons?: LessonButton[][];
  delay?: number;
  quiz?: Quiz;
  assessment?: AssessmentQuiz;
}

export interface Course {
  name: string;
  description: string;
  author: string;
  duration: string;
  lessons: CourseLesson[];
}

let cachedCourse: CourseLesson[] | null = null;

export async function loadCourse(): Promise<CourseLesson[]> {
  if (cachedCourse) {
    return cachedCourse;
  }

  try {
    const coursePath = path.join(
      process.cwd(),
      "data",
      process.env.NODE_ENV === "development"
        ? "course-dev.json"
        : "course.json",
    );

    const courseData = await fs.readFile(coursePath, "utf-8");
    const course: Course = JSON.parse(courseData);

    // Валідація структури уроків
    const validatedLessons = course.lessons.map((lesson, index) => {
      if (lesson.type === "quiz") {
        if (!lesson.quiz) {
          throw new Error(`Quiz lesson at index ${index} missing quiz data`);
        }
        validateQuiz(lesson.quiz, index);
      }

      if (lesson.type === "assessment_quiz") {
        if (!lesson.assessment) {
          throw new Error(
            `Assessment quiz lesson at index ${index} missing assessment data`,
          );
        }
        validateAssessmentQuiz(lesson.assessment, index);
      }

      return lesson;
    });

    cachedCourse = validatedLessons;
    const quizCount = course.lessons.filter((l) => l.type === "quiz").length;
    const assessmentCount = course.lessons.filter(
      (l) => l.type === "assessment_quiz",
    ).length;

    console.log(
      `Course loaded: ${course.lessons.length} lessons (${quizCount} quizzes, ${assessmentCount} assessments)`,
    );

    return cachedCourse;
  } catch (error) {
    console.error("Error loading course:", error);
    throw new Error("Failed to load course data");
  }
}

function validateQuiz(quiz: Quiz, lessonIndex: number): void {
  if (!quiz.title || typeof quiz.title !== "string") {
    throw new Error(
      `Quiz at lesson ${lessonIndex}: title is required and must be a string`,
    );
  }

  if (
    !quiz.passScore ||
    typeof quiz.passScore !== "number" ||
    quiz.passScore < 0 ||
    quiz.passScore > 100
  ) {
    throw new Error(
      `Quiz at lesson ${lessonIndex}: passScore must be a number between 0 and 100`,
    );
  }

  if (!Array.isArray(quiz.questions) || quiz.questions.length === 0) {
    throw new Error(
      `Quiz at lesson ${lessonIndex}: questions array is required and cannot be empty`,
    );
  }

  quiz.questions.forEach((question, qIndex) => {
    if (!question.question || typeof question.question !== "string") {
      throw new Error(
        `Quiz at lesson ${lessonIndex}, question ${qIndex}: question text is required`,
      );
    }

    if (!Array.isArray(question.options) || question.options.length < 2) {
      throw new Error(
        `Quiz at lesson ${lessonIndex}, question ${qIndex}: must have at least 2 options`,
      );
    }

    if (
      typeof question.correct !== "number" ||
      question.correct < 0 ||
      question.correct >= question.options.length
    ) {
      throw new Error(
        `Quiz at lesson ${lessonIndex}, question ${qIndex}: correct answer index is invalid`,
      );
    }

    question.options.forEach((option, oIndex) => {
      if (typeof option !== "string" || option.trim().length === 0) {
        throw new Error(
          `Quiz at lesson ${lessonIndex}, question ${qIndex}, option ${oIndex}: option must be a non-empty string`,
        );
      }
    });

    if (question.explanation && typeof question.explanation !== "string") {
      throw new Error(
        `Quiz at lesson ${lessonIndex}, question ${qIndex}: explanation must be a string if provided`,
      );
    }
  });
}

function validateAssessmentQuiz(
  assessment: AssessmentQuiz,
  lessonIndex: number,
): void {
  if (!assessment.title || typeof assessment.title !== "string") {
    throw new Error(
      `Assessment at lesson ${lessonIndex}: title is required and must be a string`,
    );
  }

  if (!assessment.description || typeof assessment.description !== "string") {
    throw new Error(
      `Assessment at lesson ${lessonIndex}: description is required and must be a string`,
    );
  }

  if (
    !Array.isArray(assessment.questions) ||
    assessment.questions.length === 0
  ) {
    throw new Error(
      `Assessment at lesson ${lessonIndex}: questions array is required and cannot be empty`,
    );
  }

  if (!Array.isArray(assessment.ranges) || assessment.ranges.length === 0) {
    throw new Error(
      `Assessment at lesson ${lessonIndex}: ranges array is required and cannot be empty`,
    );
  }

  // Валідація питань
  assessment.questions.forEach((question, qIndex) => {
    if (!question.question || typeof question.question !== "string") {
      throw new Error(
        `Assessment at lesson ${lessonIndex}, question ${qIndex}: question text is required`,
      );
    }
  });

  // Валідація діапазонів
  assessment.ranges.forEach((range, rIndex) => {
    if (typeof range.min !== "number" || typeof range.max !== "number") {
      throw new Error(
        `Assessment at lesson ${lessonIndex}, range ${rIndex}: min and max must be numbers`,
      );
    }

    if (range.min > range.max) {
      throw new Error(
        `Assessment at lesson ${lessonIndex}, range ${rIndex}: min cannot be greater than max`,
      );
    }

    if (range.min < 0 || range.max < 0) {
      throw new Error(
        `Assessment at lesson ${lessonIndex}, range ${rIndex}: min and max cannot be negative`,
      );
    }

    if (!range.title || typeof range.title !== "string") {
      throw new Error(
        `Assessment at lesson ${lessonIndex}, range ${rIndex}: title is required and must be a string`,
      );
    }

    if (!range.description || typeof range.description !== "string") {
      throw new Error(
        `Assessment at lesson ${lessonIndex}, range ${rIndex}: description is required and must be a string`,
      );
    }

    if (range.advice && typeof range.advice !== "string") {
      throw new Error(
        `Assessment at lesson ${lessonIndex}, range ${rIndex}: advice must be a string if provided`,
      );
    }
  });

  // Перевіряємо покриття діапазонів
  const maxQuestions = assessment.questions.length;
  const sortedRanges = assessment.ranges.sort((a, b) => a.min - b.min);

  // Перевіряємо чи є діапазон для 0
  if (sortedRanges[0].min > 0) {
    throw new Error(
      `Assessment at lesson ${lessonIndex}: no range covers 0 answers`,
    );
  }

  // Перевіряємо чи є діапазон для максимальної кількості відповідей
  if (sortedRanges[sortedRanges.length - 1].max < maxQuestions) {
    throw new Error(
      `Assessment at lesson ${lessonIndex}: no range covers maximum possible answers (${maxQuestions})`,
    );
  }

  // Перевіряємо перекриття діапазонів
  for (let i = 0; i < sortedRanges.length - 1; i++) {
    const current = sortedRanges[i];
    const next = sortedRanges[i + 1];

    if (current.max >= next.min && current.max !== next.min - 1) {
      console.warn(
        `Assessment at lesson ${lessonIndex}: ranges ${i} and ${i + 1} may overlap or have gaps`,
      );
    }
  }
}

// Функція для очищення кешу
export function clearCourseCache(): void {
  cachedCourse = null;
  console.log("Course cache cleared");
}

// Функція для отримання статистики курсу
export async function getCourseStats(): Promise<{
  totalLessons: number;
  quizCount: number;
  assessmentCount: number;
  textLessons: number;
  videoLessons: number;
  photoLessons: number;
  documentLessons: number;
  mediaGroupLessons: number;
}> {
  const course = await loadCourse();

  return {
    totalLessons: course.length,
    quizCount: course.filter((l) => l.type === "quiz").length,
    assessmentCount: course.filter((l) => l.type === "assessment_quiz").length,
    textLessons: course.filter((l) => l.type === "text").length,
    videoLessons: course.filter((l) => l.type === "video").length,
    photoLessons: course.filter((l) => l.type === "photo").length,
    documentLessons: course.filter((l) => l.type === "document").length,
    mediaGroupLessons: course.filter((l) => l.type === "media_group").length,
  };
}

// Функція для отримання конкретного уроку за індексом
export async function getLesson(index: number): Promise<CourseLesson | null> {
  const course = await loadCourse();
  return course[index] || null;
}

// Функція для отримання всіх квізів з курсу
export async function getAllQuizzes(): Promise<
  Array<{ lessonIndex: number; quiz: Quiz; title: string }>
> {
  const course = await loadCourse();
  return course
    .map((lesson, index) => ({ lesson, index }))
    .filter(({ lesson }) => lesson.type === "quiz" && lesson.quiz)
    .map(({ lesson, index }) => ({
      lessonIndex: index,
      quiz: lesson.quiz!,
      title: lesson.title,
    }));
}

// Функція для отримання всіх тестів самооцінки з курсу
export async function getAllAssessments(): Promise<
  Array<{ lessonIndex: number; assessment: AssessmentQuiz; title: string }>
> {
  const course = await loadCourse();
  return course
    .map((lesson, index) => ({ lesson, index }))
    .filter(
      ({ lesson }) => lesson.type === "assessment_quiz" && lesson.assessment,
    )
    .map(({ lesson, index }) => ({
      lessonIndex: index,
      assessment: lesson.assessment!,
      title: lesson.title,
    }));
}
