import { GrammyError, InputFile } from "grammy";
import type { MyContext } from "../../types";
import type { CourseLesson } from "../../services/courseLoader";
import { LIMITS } from "../../config/constants";
import { taskScheduler } from "../../index";

export async function sendLessonWithRetry(
  ctx: MyContext,
  lesson: CourseLesson,
  maxRetries: number = LIMITS.RETRY_ATTEMPTS,
): Promise<boolean> {
  const userId = ctx.from!.id.toString();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const hasNext = await sendLessonOptimized(ctx, lesson);
      return hasNext;
    } catch (error) {
      if (error instanceof GrammyError) {
        if (error.error_code === 429) {
          const retryAfter = error.parameters?.retry_after || 30;
          console.log(
            `[LESSON] Rate limited, waiting ${retryAfter} seconds...`,
          );

          await new Promise((resolve) => {
            taskScheduler.schedule(
              userId,
              async () => {
                resolve(undefined);
              },
              retryAfter * 1000,
            );
          });
          continue;
        } else if (error.error_code === 403) {
          throw error;
        }
      }

      if (attempt === maxRetries) {
        throw error;
      }

      await new Promise((resolve) => {
        taskScheduler.schedule(
          userId,
          async () => {
            resolve(undefined);
          },
          Math.pow(2, attempt) * 1000,
        );
      });
    }
  }
  return false;
}

async function sendLessonOptimized(
  ctx: MyContext,
  lesson: CourseLesson,
): Promise<boolean> {
  const { type, content, media, buttons, medias } = lesson;

  const hasNextButton = buttons?.some((row) =>
    row.some((btn) => {
      const hasNext =
        btn.callback_data === "next" ||
        btn.callback_data === "dalej" ||
        btn.callback_data?.includes("next") ||
        btn.callback_data?.includes("dalej") ||
        btn.text.toLowerCase().includes("dalej") ||
        btn.text.toLowerCase().includes("next");

      if (hasNext) {
        console.log(
          `[LESSON] Found NEXT button: text="${btn.text}", callback_data="${btn.callback_data}"`,
        );
      }

      return hasNext;
    }),
  );

  const keyboard = buttons
    ? {
        inline_keyboard: buttons
          .map((row) =>
            row
              .filter((btn) => btn.url || btn.callback_data)
              .map((btn) => {
                const button: any = { text: btn.text };
                if (btn.url) button.url = btn.url;
                if (btn.callback_data) button.callback_data = btn.callback_data;
                return button;
              }),
          )
          .filter((row) => row.length > 0),
      }
    : undefined;

  const baseOptions = {
    parse_mode: "HTML" as const,
    reply_markup: keyboard,
  };

  try {
    switch (type) {
      case "text":
        await ctx.reply(content, baseOptions);
        break;

      case "photo":
        if (media?.url) {
          await ctx.replyWithPhoto(media.url, {
            caption: content,
            ...baseOptions,
          });
        } else if (media?.path) {
          await ctx.replyWithPhoto(new InputFile(media.path), {
            caption: content,
            ...baseOptions,
          });
        }
        break;

      case "video":
        const videoSource =
          media?.url ||
          (media?.path
            ? new InputFile(media.path)
            : "BAACAgIAAxkBAAIFb2i7Ku_7gQAB2QnvBi8aBOtwklwdEAAClYQAAtjq2UkYP2y71Flf4DYE");

        await ctx.replyWithVideo(videoSource, {
          caption: content,
          ...baseOptions,
        });
        break;

      case "document":
        if (media?.url) {
          await ctx.replyWithDocument(media.url, {
            caption: content,
            ...baseOptions,
          });
        } else if (media?.path) {
          await ctx.replyWithDocument(new InputFile(media.path), {
            caption: content,
            ...baseOptions,
          });
        }
        break;

      case "documents":
        medias?.map(async (item) => {
          if (item?.url) {
            await ctx.replyWithDocument(item.url, {
              caption: content,
              ...baseOptions,
            });
          } else if (item?.path) {
            await ctx.replyWithDocument(new InputFile(item.path), {
              caption: content,
              ...baseOptions,
            });
          }
        });

        break;

      case "video_note":
        if (media?.url) {
          const videoNoteSource =
            media?.url ||
            (media?.path
              ? new InputFile(media.path)
              : "BAACAgIAAxkBAAIFb2i7Ku_7gQAB2QnvBi8aBOtwklwdEAAClYQAAtjq2UkYP2y71Flf4DYE");

          await ctx.replyWithVideoNote(videoNoteSource);

          if (content || keyboard) {
            await ctx.reply(content || "⭕️", {
              reply_markup: keyboard,
              parse_mode: "HTML",
            });
          }
        }

        break;

      case "media_group":
        if (media?.items) {
          const mediaGroup = media.items.map((item, index) => ({
            type: item.type as "photo" | "video",
            media: item.url || new InputFile(item.path!),
            caption: index === 0 ? content : undefined,
            parse_mode: "HTML" as const,
          }));
          await ctx.replyWithMediaGroup(mediaGroup);

          if (keyboard) {
            await ctx.reply("⬇️⬇️⬇️", { reply_markup: keyboard });
          }
        }
        break;

      default:
        throw new Error(`Unknown lesson type: ${type}`);
    }

    return hasNextButton || false;
  } catch (error) {
    console.error("Error sending lesson:", error);
    throw error;
  }
}
