import { GrammyError, InputFile } from "grammy";
import type { MyContext } from "../../types";
import type { CourseLesson } from "../../services/courseLoader";
import { LIMITS } from "../../config/constants";
import { sleep } from "../../utils/sleep";

export async function sendLessonWithRetry(
  ctx: MyContext,
  lesson: CourseLesson,
  maxRetries: number = LIMITS.RETRY_ATTEMPTS,
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await sendLessonOptimized(ctx, lesson);
    } catch (error) {
      console.error(`Attempt ${attempt} failed for lesson:`, error);

      if (error instanceof GrammyError) {
        if (error.error_code === 429) {
          const retryAfter = error.parameters?.retry_after || 30;
          console.log(`Rate limited, waiting ${retryAfter} seconds...`);
          await sleep(retryAfter * 1000);
          continue;
        } else if (error.error_code === 403) {
          throw error;
        }
      }

      if (attempt === maxRetries) {
        throw error;
      }

      await sleep(Math.pow(2, attempt) * 1000);
    }
  }
  return false;
}

async function sendLessonOptimized(
  ctx: MyContext,
  lesson: CourseLesson,
): Promise<boolean> {
  const { type, content, media, buttons, medias } = lesson;

  const photoDev =
    "AgACAgIAAxkBAAIBDmjkX0tF2ZbPRObEDGInCGJgdb7QAAKwAzIbdjcgS__zjr1w3Ou3AQADAgADeQADNgQ";
  const videoDev =
    "BAACAgIAAxkBAAOmaNkRnw9xtQUWJr_GRopVL2prMf8AAriKAAIB78lKRGSTsH48XH82BA";
  const documentDev =
    "BQACAgIAAxkBAAIBDGjkXsTGKlTn9aHwhphRoYA04B3WAAJSjwACdjcgSxiGTR3MEo83NgQ";

  const hasNextButton = buttons?.some((row) =>
    row.some(
      (btn) =>
        btn.callback_data?.includes("next") ||
        btn.callback_data?.includes("dalej") ||
        btn.text.toLowerCase().includes("dalej") ||
        btn.text.toLowerCase().includes("next"),
    ),
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
          await ctx.replyWithPhoto(
            process.env.NODE_ENV === "development" ? photoDev : media.url,
            {
              caption: content,
              ...baseOptions,
            },
          );
        } else if (media?.path) {
          await ctx.replyWithPhoto(
            new InputFile(
              process.env.NODE_ENV === "development" ? photoDev : media.path,
            ),
            {
              caption: content,
              ...baseOptions,
            },
          );
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
            await ctx.replyWithDocument(
              process.env.NODE_ENV === "development" ? documentDev : item.url,
              {
                caption: content,
                ...baseOptions,
              },
            );
          } else if (item?.path) {
            await ctx.replyWithDocument(
              new InputFile(
                process.env.NODE_ENV === "development"
                  ? documentDev
                  : item.path,
              ),
              {
                caption: content,
                ...baseOptions,
              },
            );
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
            media:
              process.env.NODE_ENV === "development"
                ? item.type === "photo"
                  ? photoDev
                  : videoDev
                : item.url || new InputFile(item.path!),
            caption: index === 0 ? content : undefined,
            parse_mode: "HTML" as const,
          }));
          await ctx.replyWithMediaGroup(mediaGroup);

          if (keyboard) {
            await ctx.reply("=======", { reply_markup: keyboard });
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
