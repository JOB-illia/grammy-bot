import { MyContext } from "../types";

export const getFileIdDocument = async (ctx: MyContext) => {
  try {
    const fileId = ctx.message!.document?.file_id;
    console.log("📄 DOCUMENT FILE_ID:", fileId);
    await ctx.reply(`file_id:\n${fileId}`);
  } catch (error) {
    console.error("Error handling document message:", error);
  }
};

export const getFileIdVideo = async (ctx: MyContext) => {
  try {
    const fileId = ctx.message!.video?.file_id;
    console.log("📦 VIDEO FILE_ID:", fileId);
    await ctx.reply(`file_id:\n${fileId}`);
  } catch (error) {
    console.error("Error handling video message:", error);
  }
};

export const getFileIdPhoto = async (ctx: MyContext) => {
  try {
    const photo = ctx.message!.photo;
    const fileId = photo![photo!.length - 1].file_id;
    console.log("📸 PHOTO FILE_ID:", fileId);
    await ctx.reply(`file_id:\n${fileId}`);
  } catch (error) {
    console.error("Error handling photo message:", error);
  }
};
