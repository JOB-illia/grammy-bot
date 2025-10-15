// src/services/whatsapp360.ts
// Cloud-сумісний клієнт для 360dialog (waba-v2.360dialog.io)

type LanguageCode = "pl" | "pl_PL" | "uk" | "en" | "ru" | string;

export interface WhatsApp360Config {
  apiUrl?: string; // default: https://waba-v2.360dialog.io
  apiKey: string; // заголовок D360-API-KEY
  defaultLanguage?: LanguageCode; // default: "pl"
  testMode?: boolean; // dry-run (лог без фактичної відправки)
  testRecipient?: string; // куди слати у testMode
  rateLimitMs?: number; // пауза між відправками у батчі (додаткова)
  maxRetries?: number; // ретраї 429/5xx
  templatesTtlMs?: number; // TTL кешу шаблонів (default 30 хв)
}

export interface TemplateMessage {
  to: string; // E.164 без '+', напр. "48575784438"
  name: string; // назва шаблону, напр. "new_tarif"
  language?: LanguageCode; // напр. "pl" або "pl_PL"
  bodyParams?: string[]; // (на майбутнє) якщо додаси плейсхолдери
  buttonParams?: string[]; // (на майбутнє) для dynamic URL кнопок
}

export interface TextMessage {
  to: string;
  body: string;
  previewUrl?: boolean;
}

type WabaTemplate = {
  name: string;
  language: string;
  status: string; // "approved"
  category?: string;
  components?: any[];
};

export class WhatsApp360 {
  private apiUrl: string;
  private apiKey: string;
  private lang: LanguageCode;
  private dryRun: boolean;
  private testRecipient?: string;
  private maxRetries: number;
  private templatesTtlMs: number;

  // Кеш шаблонів
  private templatesCache: { at: number; list: WabaTemplate[] } | null = null;

  constructor(cfg: WhatsApp360Config) {
    this.apiUrl = (cfg.apiUrl ?? "https://waba-v2.360dialog.io").replace(
      /\/+$/,
      "",
    );
    this.apiKey = cfg.apiKey;
    this.lang = cfg.defaultLanguage ?? "pl";
    this.dryRun = !!cfg.testMode;
    this.testRecipient = cfg.testRecipient;
    this.maxRetries = cfg.maxRetries ?? 3;
    this.templatesTtlMs = cfg.templatesTtlMs ?? 30 * 60 * 1000; // 30 хв
  }

  // ===== Utils =====
  private sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  private async callApi(
    path: string,
    payload: any,
    label: string,
  ): Promise<void> {
    if (this.dryRun) {
      console.log(`[WA:DRY-RUN] ${label}`, JSON.stringify(payload, null, 2));
      return;
    }

    let attempt = 0;
    while (true) {
      attempt++;
      const res = await fetch(`${this.apiUrl}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "D360-API-KEY": this.apiKey,
        },
        body: JSON.stringify(payload),
      });

      const text = await res.text().catch(() => "");
      const status = res.status;

      if (res.ok) {
        console.log(`[WA ✅] ${label} OK (${status})`);
        return;
      }

      // Ретраїмо 429/5xx
      const isTransient = status === 429 || (status >= 500 && status < 600);
      if (isTransient && attempt <= this.maxRetries) {
        // Backoff + невелика додаткова пауза
        const backoff = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        console.warn(
          `[WA] ${label} failed (${status}). Retry in ${backoff}ms. Body: ${text}`,
        );
        await this.sleep(backoff);
        continue;
      }

      console.error(`[WA] ${label} failed (${status}): ${text}`);
      throw new Error(`[WA] ${label} failed (${status}): ${text}`);
    }
  }

  private templatesCacheValid(): boolean {
    return (
      !!this.templatesCache &&
      Date.now() - this.templatesCache.at < this.templatesTtlMs
    );
  }

  private async getTemplatesFromApi(): Promise<WabaTemplate[]> {
    const res = await fetch(`${this.apiUrl}/v1/configs/templates`, {
      method: "GET",
      headers: { "D360-API-KEY": this.apiKey },
    });
    const raw = await res.text();

    if (res.status === 429) throw new Error(`TEMPLATES_RATE_LIMIT: ${raw}`);
    if (!res.ok)
      throw new Error(`TEMPLATES_FETCH_FAILED ${res.status}: ${raw}`);

    let json: any = {};
    try {
      json = JSON.parse(raw);
    } catch {
      return [];
    }

    if (Array.isArray(json?.waba_templates))
      return json.waba_templates as WabaTemplate[];
    if (Array.isArray(json?.data)) return json.data as WabaTemplate[];
    if (Array.isArray(json?.templates)) return json.templates as WabaTemplate[];
    return [];
  }

  /** Виклич ДО розсилки — закешує шаблони, щоб не ловити 429 у циклі */
  async primeTemplates(): Promise<void> {
    try {
      const list = await this.getTemplatesFromApi();
      this.templatesCache = { at: Date.now(), list };
      console.log(`[WA] Templates cached: ${list.length}`);
    } catch (e: any) {
      if (String(e?.message || "").startsWith("TEMPLATES_RATE_LIMIT")) {
        console.warn("[WA] primeTemplates hit 429 — proceed without refresh");
      } else {
        console.warn("[WA] primeTemplates failed:", e?.message || e);
      }
    }
  }

  private findTemplateInCache(name: string, lang: string): WabaTemplate | null {
    if (!this.templatesCacheValid()) return null;
    const list = this.templatesCache!.list;
    return (
      list.find((t) => t.name === name && t.language === lang) ||
      list.find((t) => t.name === name) ||
      null
    );
  }

  // ===== Senders =====

  /** Cloud-формат TEXT */
  async sendText(msg: TextMessage): Promise<void> {
    const to = this.dryRun && this.testRecipient ? this.testRecipient : msg.to;
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { body: msg.body, preview_url: !!msg.previewUrl },
    };
    // ВАЖЛИВО: /messages (без /v1)
    await this.callApi("/messages", payload, `TEXT -> ${to}`);
  }

  /** Cloud-формат TEMPLATE без плейсхолдерів */
  async sendTemplate(msg: TemplateMessage): Promise<void> {
    const to = this.dryRun && this.testRecipient ? this.testRecipient : msg.to;
    const lang = msg.language ?? this.lang;

    // 1) Прагнемо уникати звернення до /configs/templates у циклі
    let tpl = this.findTemplateInCache(msg.name, lang);

    // 2) Якщо кеш прострочений — одна спроба оновити (поза циклом краще primeTemplates())
    if (!tpl && !this.templatesCacheValid()) {
      try {
        await this.primeTemplates();
        tpl = this.findTemplateInCache(msg.name, lang);
      } catch {
        /* ідемо далі фолбеком */
      }
    }

    const languageCode = tpl?.language || lang;

    const payload: any = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: {
        name: msg.name,
        language: {
          policy: "deterministic", // must-have для Cloud
          code: languageCode,
        },
      },
    };

    console.log("📦 WA PAYLOAD:", JSON.stringify(payload.to, null, 2));
    await this.callApi("/messages", payload, `TEMPLATE(${msg.name}) -> ${to}`);
  }
}
