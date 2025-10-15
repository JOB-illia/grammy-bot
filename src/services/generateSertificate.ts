import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFFont, PDFPage, rgb, degrees } from "pdf-lib";

type Align = "left" | "center" | "right";
type Lang = "pl" | "en";

export interface GenerateOptions {
  templatePath: string;
  fontPath: string;

  centerX: number;
  boxWidth: number;
  boxHeight: number;
  baselineY: number;
  lineGap: number;

  maxFontSize: number;
  minFontSize: number;

  letterSpacing: number;
  align: Align;
  rotateDeg: number;

  color?: { r: number; g: number; b: number };
  shadowColor?: { r: number; g: number; b: number };
  shadowOffset?: { dx: number; dy: number };

  debug?: boolean;

  // --- Дата ---
  dateLang?: Lang;
  dateFontPath?: string;
  /** Якщо true — лівий край дати = лівому краю імені/прізвища */
  dateAlignWithNameLeft?: boolean;
  /** Якщо треба окремий X — можна задати вручну (якщо dateAlignWithNameLeft=false) */
  dateX?: number;
  /** Базова лінія дати (від НИЗУ сторінки, pt) — рівно «по лінії» макету */
  dateBaselineY?: number;
  dateSize?: number;
  dateUppercase?: boolean;
  dateColor?: { r: number; g: number; b: number };
  /** Дрібна поправка до baseline в частках розміру шрифту (наприклад, -0.05) */
  dateBaselineOffset?: number;
  /** Показати допоміжну лінію дати для калібрування */
  debugDateLine?: boolean;
}

const GOLD = { r: 211 / 255, g: 203 / 255, b: 159 / 255 }; // #D4AF37

const defaults: GenerateOptions = {
  templatePath: path.join(process.cwd(), "template.pdf"),
  fontPath: path.join(process.cwd(), "fonts", "Roboto-Regular.ttf"),

  centerX: 375,
  boxWidth: 300,
  boxHeight: 120,
  baselineY: 460,
  lineGap: 10,

  maxFontSize: 56,
  minFontSize: 18,

  letterSpacing: 0,
  align: "left",
  rotateDeg: 0,

  color: { r: 1, g: 1, b: 1 },
  shadowColor: { r: 0, g: 0, b: 0 },
  shadowOffset: { dx: 0.6, dy: -0.6 },

  debug: false,

  dateLang: "pl",
  dateFontPath: path.join(process.cwd(), "monst.ttf"),
  dateAlignWithNameLeft: true, // ← ВАЖЛИВО: лівий край = як у імені
  dateX: 40, // використається лише якщо dateAlignWithNameLeft=false
  dateBaselineY: 60, // постав точне значення для «лінії» з макету
  dateSize: 12,
  dateUppercase: true,
  dateColor: GOLD,
  dateBaselineOffset: -0.05,
  debugDateLine: false,
};

export async function generateCertificate(
  fullName: string,
  opts?: Partial<GenerateOptions>,
): Promise<Uint8Array> {
  const cfg: GenerateOptions = { ...defaults, ...opts };

  if (!fs.existsSync(cfg.templatePath))
    throw new Error(`PDF-шаблон не знайдено: ${cfg.templatePath}`);
  if (!fs.existsSync(cfg.fontPath))
    throw new Error(`Шрифт не знайдено: ${cfg.fontPath}`);

  const [templateBytes, fontBytes] = await Promise.all([
    fsp.readFile(cfg.templatePath),
    fsp.readFile(cfg.fontPath),
  ]);

  const pdfDoc = await PDFDocument.load(templateBytes);
  pdfDoc.registerFontkit(fontkit);

  const nameFont: PDFFont = await pdfDoc.embedFont(fontBytes, { subset: true });
  const page: PDFPage = pdfDoc.getPages()[0];
  const { width: pageW } = page.getSize();

  // ===== допоміжки =====
  const widthAt = (text: string, size: number, font = nameFont) =>
    font.widthOfTextAtSize(text, size) +
    cfg.letterSpacing * Math.max(0, text.length - 1);

  const lineHeight = (size: number) => size * 1.1;
  const leftEdgeX = cfg.centerX - cfg.boxWidth / 2;

  const xFor = (text: string, size: number): number => {
    const w = widthAt(text, size);
    if (cfg.align === "left") return leftEdgeX;
    if (cfg.align === "right") return leftEdgeX + cfg.boxWidth - w;
    return leftEdgeX + (cfg.boxWidth - w) / 2;
  };

  const drawText = (text: string, x: number, y: number, size: number) => {
    if (cfg.shadowOffset && cfg.shadowColor) {
      page.drawText(text, {
        x: x + cfg.shadowOffset.dx,
        y: y + cfg.shadowOffset.dy,
        size,
        font: nameFont,
        color: rgb(cfg.shadowColor.r!, cfg.shadowColor.g!, cfg.shadowColor.b!),
        rotate: degrees(cfg.rotateDeg),
      });
    }
    page.drawText(text, {
      x,
      y,
      size,
      font: nameFont,
      color: rgb(cfg.color!.r, cfg.color!.g, cfg.color!.b),
      rotate: degrees(cfg.rotateDeg),
    });
  };

  // ===== ім'я (1 або 2 рядки) =====
  const cleaned = fullName.replace(/\s+/g, " ").trim();

  let size = cfg.maxFontSize;
  while (size > cfg.minFontSize && widthAt(cleaned, size) > cfg.boxWidth)
    size--;

  if (
    widthAt(cleaned, size) <= cfg.boxWidth &&
    lineHeight(size) <= cfg.boxHeight
  ) {
    drawText(cleaned, xFor(cleaned, size), cfg.baselineY, size);
  } else {
    const [l1, l2] = splitIntoTwoLinesGreedyByWidth(
      cleaned,
      (s) => widthAt(s, size),
      cfg.boxWidth,
    );
    size = cfg.maxFontSize;
    while (size > cfg.minFontSize) {
      const tooWide =
        widthAt(l1, size) > cfg.boxWidth || widthAt(l2, size) > cfg.boxWidth;
      const tooTall = lineHeight(size) * 2 + cfg.lineGap > cfg.boxHeight;
      if (!tooWide && !tooTall) break;
      size--;
    }
    const baseline2 = cfg.baselineY;
    const baseline1 = baseline2 + lineHeight(size) + cfg.lineGap;
    drawText(l1, xFor(l1, size), baseline1, size);
    drawText(l2, xFor(l2, size), baseline2, size);
  }

  if (cfg.debug) debugBox(page, cfg, pageW);

  if (cfg.dateFontPath && fs.existsSync(cfg.dateFontPath)) {
    const dateFontBytes = await fsp.readFile(cfg.dateFontPath);
    const dateFont = await pdfDoc.embedFont(dateFontBytes, { subset: true });

    const now = new Date();
    let dateText = formatMonthYear(now, cfg.dateLang ?? "pl");
    if (cfg.dateUppercase)
      dateText = dateText.toLocaleUpperCase(cfg.dateLang ?? "pl");

    // лівий X: або примусово з ім'ям, або вручну
    const dateX = cfg.dateAlignWithNameLeft
      ? leftEdgeX
      : (cfg.dateX ?? leftEdgeX);

    // baseline із мікропоправкою метрик шрифту
    const y =
      (cfg.dateBaselineY ?? 60) + cfg.dateSize! * (cfg.dateBaselineOffset ?? 0);

    page.drawText(dateText, {
      x: dateX,
      y,
      size: cfg.dateSize!,
      font: dateFont,
      color: rgb(cfg.dateColor!.r, cfg.dateColor!.g, cfg.dateColor!.b),
    });

    // опційна допоміжна лінія для калібрування
    if (cfg.debugDateLine) {
      page.drawLine({
        start: { x: dateX - 10, y: cfg.dateBaselineY! },
        end: { x: dateX + 300, y: cfg.dateBaselineY! },
        thickness: 0.8,
        color: rgb(0.9, 0.2, 0.2),
      });
    }
  }

  return pdfDoc.save();
}

// спліт у два рядки — жадібно по ширині (гарно для left-align)
function splitIntoTwoLinesGreedyByWidth(
  text: string,
  measure: (s: string) => number,
  maxWidth: number,
): [string, string] {
  const words = text.split(" ");
  if (words.length < 2) return [text, ""];
  let line1 = words[0];
  let i = 1;
  while (i < words.length) {
    const next = line1 + " " + words[i];
    if (measure(next) <= maxWidth) {
      line1 = next;
      i++;
    } else break;
  }
  const line2 = words.slice(i).join(" ");
  return [line1, line2];
}

// форматування дати
function formatMonthYear(d: Date, lang: "pl" | "en"): string {
  const monthsPL = [
    "styczeń",
    "luty",
    "marzec",
    "kwiecień",
    "maj",
    "czerwiec",
    "lipiec",
    "sierpień",
    "wrzesień",
    "październik",
    "listopad",
    "grudzień",
  ];
  const monthsEN = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const m = lang === "pl" ? monthsPL[d.getMonth()] : monthsEN[d.getMonth()];
  return `${m} ${d.getFullYear()}`;
}

// дебаг-рамка
function debugBox(page: PDFPage, cfg: GenerateOptions, pageW: number) {
  const x = cfg.centerX - cfg.boxWidth / 2;
  page.drawRectangle({
    x,
    y: cfg.baselineY - cfg.boxHeight + 2,
    width: cfg.boxWidth,
    height: cfg.boxHeight,
    borderColor: rgb(0.9, 0.2, 0.2),
    borderWidth: 1,
  });
  const step = 50;
  for (let y = 0; y <= page.getSize().height; y += step) {
    page.drawLine({
      start: { x: 0, y },
      end: { x: pageW, y },
      thickness: y % 100 === 0 ? 0.8 : 0.2,
      color: rgb(0.7, 0.7, 0.7),
    });
  }
}
