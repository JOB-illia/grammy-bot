import dotenv from "dotenv";

dotenv.config();

export const botConfig = {
  token: "8426103334:AAGRl86eZjH9Y5a7tb31ILVv0-sWYePE33w",
  adminIds: process.env.ADMIN_IDS?.split(",") || [],
  environment: process.env.NODE_ENV || "development",
  courseMode: process.env.COURSE_MODE || "instant",

  api: {
    timeoutSeconds: 80,
    environment: "prod",
    sensitiveLogs: false,
  },
};

export const isDevelopment = botConfig.environment === "development";
export const isProduction = botConfig.environment === "production";
export const isAdmin = (userId: string) => botConfig.adminIds.includes(userId);
