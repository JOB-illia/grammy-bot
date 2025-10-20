import type { MyContext } from "../types";
import "dotenv/config";

import path from "path";

import { InputFile, NextFunction } from "grammy";
import { generateCertificate } from "../services/generateSertificate";

const waitingForName = new Set<number>();

export const generateCertificateCommand = async (ctx: MyContext) => {
  ctx.session.waitingForName = [
    ...ctx.session.waitingForName,
    ctx.from!.id ?? "",
  ];
  await ctx.reply(
    "Напишіть, будь ласка, ваше ім’я та прізвище (наприклад: Іван Іваненко)",
  );
};

const namePattern =
  /^[A-Za-zĄĆĘŁŃÓŚŹŻа-яА-ЯёЁіІїЇєЄ]+(?: [A-Za-zĄĆĘŁŃÓŚŹŻа-яА-ЯёЁіІїЇєЄ]+)?$/;

export const messageHandler = async (ctx: MyContext, next: NextFunction) => {
  const uid = ctx.from!.id;
  const find = ctx.session.waitingForName.find((item) => item === uid);

  if (ctx.session?.mode === "admin") return;

  if (!find) return ctx.reply("Probuje jescsze raz");

  const fullName = (ctx.message!.text ?? "").trim().replace(/\s+/g, " ");

  if (
    fullName.length < 3 ||
    (fullName.length > 64 && !namePattern.test(fullName))
  ) {
    return ctx.reply(
      "Wygląda na to, że to nie jest imię. Spróbuj ponownie (3–64 znaki).",
    );
  }

  waitingForName.delete(uid);

  const dateFont = path.join(process.cwd(), "monst.ttf");

  try {
    await ctx.reply("⏳ Generuje certificate - daj mi chwile ⌛");

    const pdfBytes = await generateCertificate(fullName, {
      templatePath: path.join(process.cwd(), "template_pl.pdf"),
      fontPath: path.join(process.cwd(), "MsMadi-Regular.ttf"),
      minFontSize: 18,
      dateLang: "pl",
      dateFontPath: dateFont,
      dateX: 40,
      dateBaselineY: 60,
      dateSize: 12,
    });

    const pdfBytesEn = await generateCertificate(fullName, {
      templatePath: path.join(process.cwd(), "template_eng.pdf"),
      fontPath: path.join(process.cwd(), "MsMadi-Regular.ttf"),
      minFontSize: 18,
      dateLang: "en",
      dateFontPath: dateFont,
      dateX: 40,
      dateBaselineY: 60,
      dateSize: 12,
    });

    const file = new InputFile(
      Buffer.from(pdfBytes),
      `cert_${fullName.replace(/\s+/g, "_")}.pdf`,
    );

    const file_eg = new InputFile(
      Buffer.from(pdfBytesEn),
      `cert_${fullName.replace(/\s+/g, "_")}_eng.pdf`,
    );

    await ctx.replyWithDocument(file);
    await ctx.replyWithDocument(file_eg);

    ctx.session.waitingForName = [];

    return next();
  } catch (err) {
    console.error(err);
    await ctx.reply(
      "Сталася помилка при створенні сертифікату. Спробуємо ще раз.",
    );
  }
};
