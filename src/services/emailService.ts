import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: "vladlena@chokbrows.pl",
    pass: "gsgdielnvdmgozqj",
  },
  pool: true,
  maxConnections: 1, // тримаємо одне постійне TLS-з’єднання
  maxMessages: 800, // скільки листів відправити в межах одного конекту
  rateDelta: 1000, // вікно у мілісекундах...
  rateLimit: 1,
});

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  userName?: string;
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  try {
    const mailOptions = {
      from: {
        name: "Chokbrows",
        address: "vladlena@chokbrows.pl",
      },
      to: options.to,
      subject: options.subject,
      html: options.html,
    };

    const info = await transporter.sendMail(mailOptions);

    console.log("Email sent:", info.messageId, "->", options.to);
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}

// Функція для перевірки з'єднання
export async function verifyEmailConnection(): Promise<boolean> {
  try {
    await transporter.verify();
    console.log("Email server connection successful");
    return true;
  } catch (error) {
    console.error("Email server connection failed:", error);
    return false;
  }
}
