import type { Update } from "grammy/types";

const ts = () => Math.floor(Date.now() / 1000);

function makeMessageUpdate(uid: number, chatId: number): Update {
  return {
    update_id: 100_000 + uid,
    message: {
      message_id: 1,
      date: ts(),
      chat: { id: chatId, type: "private", first_name: "LoadRoom" },
      from: { id: uid, is_bot: false, first_name: `Tester${uid}` },
      text: "/start",
    },
  };
}

function makeCallbackUpdate(
  uid: number,
  chatId: number,
  data = "next",
): Update {
  return {
    update_id: 200_000 + uid + Math.floor(Math.random() * 10_000),
    callback_query: {
      id: `cb_${uid}_${Date.now()}`,
      chat_instance: `inst_${uid}`,
      from: { id: uid, is_bot: false, first_name: `User${uid}` },
      data,
      message: {
        message_id: 1000 + uid,
        date: ts(),
        chat: { id: chatId, type: "private", first_name: "LoadRoom" },
      },
    },
  };
}

/**
 * users      — скільки "юзерів"
 * rounds     — скільки натискань "next" кожним
 * chatId     — реальний chat_id (лише для e2e)
 * mode       — "dry" | "e2e"
 */
export async function simulateLoad(
  bot: any,
  { users = 30, rounds = 3, chatId = 0, mode = "dry" as "dry" | "e2e" } = {},
) {
  // 1) dry-mode: глушимо реальні sendMessage/.. щоб не летіло у TG
  if (mode === "dry") {
    bot.api.config.use(async (prev: any, method: any, payload: any) => {
      if (
        method.startsWith("send") ||
        method.startsWith("editMessage") ||
        method === "answerCallbackQuery"
      ) {
        // console.log("[DRY]", method);
        return {} as any;
      }
      return prev(method, payload);
    });
  } else {
    if (!chatId) throw new Error("SIM_MODE=e2e вимагає TEST_CHAT_ID");
  }

  await bot.init();

  const realChat = mode === "e2e" ? Number(chatId) : "-1003075496174"; // у dry будь-який id

  // 2) стартові /start від різних uid
  for (let i = 0; i < users; i++) {
    const uid = 10_000 + i;
    await bot.handleUpdate(makeMessageUpdate(uid, realChat as number));
  }

  // 3) rounds кліків "next" усіма
  for (let r = 0; r < rounds; r++) {
    await Promise.all(
      Array.from({ length: users }, (_, i) => {
        const uid = 20_000 + i;
        return bot.handleUpdate(
          makeCallbackUpdate(uid, realChat as number, "next"),
        );
      }),
    );
  }

  // 4) фінішний клік “next” ще раз — часто саме тут проявляються гонки
  await Promise.all(
    Array.from({ length: users }, (_, i) => {
      const uid = 30_000 + i;
      return bot.handleUpdate(
        makeCallbackUpdate(uid, realChat as number, "next"),
      );
    }),
  );

  // Готово
}
