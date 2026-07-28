const Express = require('express');
const { Bot } = require('grammy');

const app = Express();
app.use(Express.json());

const BOT_TOKEN = "8852639204:AAHrOtSEGcIdA2JoIbngHc894r-hzBFHb4M"; 
const MY_ID = 8922957073; 

const bot = new Bot(BOT_TOKEN);
const messagesDb = new Map(); // Память для хранения истории

// 1. БОТ ЛОВИТ ВСЕ НОВЫЕ СООБЩЕНИЯ (ТЕКСТ И МЕДИА)
bot.on('business_message', async (ctx) => {
    const msg = ctx.businessMessage;
    
    // Если это текст — просто запоминаем его
    if (msg.text) {
        messagesDb.set(msg.message_id, { type: 'text', content: msg.text });
    } 
    // Если это КРУЖОК, ФОТО или ГОЛОСОВОЕ — Муха Мессенджер ЗАРАНЕЕ пересылает его вам
    else if (msg.video_note || msg.photo || msg.voice || msg.video || msg.audio) {
        try {
            // Пересылаем медиафайл вам в личку в скрытом режиме
            const forwarded = await bot.api.forwardMessage(MY_ID, msg.chat.id, msg.message_id);
            // Запоминаем ID этой копии
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
    
    const report = `🪰 *МУХА МЕССЕНДЖЕР: ИЗМЕНЕНИЕ!*\n\n` +
                   `📍 *Где чат:* ${chatName}\n` +
                   `⏪ *Было до изменения:* ${oldText}\n` +
                   `⏩ *Стало после изменения:* ${newText}`;
    
    await bot.api.sendMessage(MY_ID, report, { parse_mode: "Markdown" });
    messagesDb.set(msg.message_id, { type: 'text', content: newText });
});

// 3. БОТ ПЕРЕХВАТЫВАЕТ УДАЛЕНИЕ (ТЕКСТА И КРУЖОЧКОВ)
bot.on('business_messages_deleted', async (ctx) => {
    const deletedData = ctx.businessMessagesDeleted;
    const chatName = deletedData.chat.title || deletedData.chat.first_name || "Личный чат";
    
    for (const msgId of deletedData.message_ids) {
        const saved = messagesDb.get(msgId);
        
        if (!saved) {
            await bot.api.sendMessage(MY_ID, `🪰 *МУХА МЕССЕНДЖЕР: УДАЛЕНИЕ!*\n📍 *Где:* ${chatName}\n❌ [Данные не успели сохраниться]`);
            continue;
        }
        
        // Если удалили ТЕКСТ
        if (saved.type === 'text') {
            const report = `🪰 *МУХА МЕССЕНДЖЕР: УДАЛЕН ТЕКСТ!*\n\n` +
                           `📍 *Где чат:* ${chatName}\n` +
                           `❌ *Что было удалено:* ${saved.content}`;
            await bot.api.sendMessage(MY_ID, report, { parse_mode: "Markdown" });
        } 
        // Если удалили КРУЖОК или ФОТО
        else if (saved.type === 'media') {
            const report = `🪰 *МУХА МЕССЕНДЖЕР: УДАЛЕН МЕДИАФАЙЛ!*\n\n` +
                           `📍 *Где чат:* ${chatName}\n` +
                           `📎 *Тип файла:* ${saved.media_type}\n` +
                           `👇 *Я сохранил его для вас! Копия отправлена выше.*`;
            
            await bot.api.sendMessage(MY_ID, report, { 
                parse_mode: "Markdown",
                reply_parameters: { message_id: saved.forwarded_id } // Подсветит сохраненный кружок
            });
        }
    }
});

app.post(`/bot${BOT_TOKEN}`, (req, res) => {
    bot.handleUpdate(req.body);
    res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("Муха Мессенджер успешно запущен на порту " + PORT);
});
