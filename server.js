const Express = require('express');
const { Bot, webhookCallback } = require('grammy');

const app = Express();
app.use(Express.json());

// Ваши данные жестко прописаны:
const BOT_TOKEN = "8852639204:AAHrOtSEGcIdA2JoIbngHc894r-hzBFHb4M"; 
const MY_ID = 8922957073; 

const bot = new Bot(BOT_TOKEN);
const messagesDb = new Map(); // Память бота для истории

// 1. БОТ АВТОМАТИЧЕСКИ ЗАПОМИНАЕТ КАЖДОЕ НОВОЕ СООБЩЕНИЕ (ТЕКСТ И МЕДИА)
bot.on('business_message', async (ctx) => {
    const msg = ctx.businessMessage;
    
    // Если это текст — запоминаем его в память
    if (msg.text) {
        messagesDb.set(msg.message_id, { type: 'text', content: msg.text });
    } 
    // Если это КРУЖОК, ФОТО или ГОЛОСОВОЕ — Муха-менеджер ЗАРАНЕЕ пересылает его вам
    else if (msg.video_note || msg.photo || msg.voice || msg.video || msg.audio) {
        try {
            const forwarded = await bot.api.forwardMessage(MY_ID, msg.chat.id, msg.message_id);
            messagesDb.set(msg.message_id, { 
                type: 'media', 
                forwarded_id: forwarded.message_id,
                media_type: msg.video_note ? 'Кружок' : msg.photo ? 'Фото' : msg.voice ? 'Голосовое' : 'Файл'
            });
        } catch (e) {
            console.log("Ошибка автосохранения медиа: ", e);
        }
    }
});

// 2. БОТ ПЕРЕХВАТЫВАЕТ ИЗМЕНЕНИЕ ТЕКСТА
bot.on('edited_business_message', async (ctx) => {
    const msg = ctx.editedBusinessMessage;
    const chatName = msg.chat.title || msg.chat.first_name || "Личный чат";
    
    const saved = messagesDb.get(msg.message_id);
    const oldText = saved && saved.type === 'text' ? saved.content : "[Раньше тут был не текст]";
    const newText = msg.text || "[Изменено на медиафайл]";
    
    const report = `🪰 *МУХА-МЕНЕДЖЕР: ИЗМЕНЕНИЕ!*\n\n` +
                   `📍 *Где чат:* ${chatName}\n` +
                   `⏪ *Было до изменения:* ${oldText}\n` +
                   `⏩ *Стало после изменения:* ${newText}`;
    
    await bot.api.sendMessage(MY_ID, report, { parse_mode: "Markdown" });
    messagesDb.set(msg.message_id, { type: 'text', content: newText });
});

// 3. БОТ ПЕРЕХВАТЫВАЕТ УДАЛЕНИЕ (ТЕКСТА И МЕДИА)
bot.on('business_messages_deleted', async (ctx) => {
    const deletedData = ctx.businessMessagesDeleted;
    const chatName = deletedData.chat.title || deletedData.chat.first_name || "Личный чат";
    
    for (const msgId of deletedData.message_ids) {
        const saved = messagesDb.get(msgId);
        
        if (!saved) {
            await bot.api.sendMessage(MY_ID, `🪰 *МУХА-МЕНЕДЖЕР: УДАЛЕНИЕ!*\n📍 *Где:* ${chatName}\n❌ [Данные не успели сохраниться]`);
            continue;
        }
        
        if (saved.type === 'text') {
            const report = `🪰 *МУХА-МЕНЕДЖЕР: УДАЛЕН ТЕКСТ!*\n\n` +
                           `📍 *Где чат:* ${chatName}\n` +
                           `❌ *Что было удалено:* ${saved.content}`;
            await bot.api.sendMessage(MY_ID, report, { parse_mode: "Markdown" });
        } 
        else if (saved.type === 'media') {
            const report = `🪰 *МУХА-МЕНЕДЖЕР: УДАЛЕН МЕДИАФАЙЛ!*\n\n` +
                           `📍 *Где чат:* ${chatName}\n` +
                           `📎 *Тип файла:* ${saved.media_type}\n` +
                           `👇 *Я сохранил его для вас! Копия отправлена выше.*`;
            
            await bot.api.sendMessage(MY_ID, report, { 
                parse_mode: "Markdown",
                reply_parameters: { message_id: saved.forwarded_id }
            });
        }
    }
});

// Настройка для работы на серверах Vercel (без портов)
app.post(`*`, webhookCallback(bot, 'express'));
module.exports = app;
