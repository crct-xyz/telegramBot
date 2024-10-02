const TelegramBot = require("node-telegram-bot-api");
const AWS = require("aws-sdk");

// Initialize AWS SDK
const sqs = new AWS.SQS();

// Initialize Telegram bot with webhook
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
  webHook: true,
});

bot.setWebHook(process.env.WEBHOOK_URL);

// Main Lambda handler
exports.handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  if (event.Records) {
    // Handle SQS messages
    return handleSQSMessages(event.Records);
  } else if (event.body) {
    // Handle Telegram updates
    return handleTelegramUpdate(event.body);
  } else {
    console.log("Unsupported event type");
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Unsupported event type" }),
    };
  }
};

async function handleSQSMessages(records) {
  for (const record of records) {
    const message = JSON.parse(record.body);
    const { blink_url, telegram_username } = message;

    if (blink_url && telegram_username) {
      await sendMessageToUser(telegram_username, blink_url);
    } else {
      console.log("Invalid message format:", message);
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "SQS messages processed successfully" }),
  };
}

async function handleTelegramUpdate(body) {
  const update = JSON.parse(body);
  await bot.processUpdate(update);

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Telegram update processed successfully" }),
  };
}

async function sendMessageToUser(username, url) {
  try {
    const chatId = await getChatIdFromUsername(username);
    if (chatId) {
      await bot.sendMessage(chatId, `Here's your link: ${url}`);
      console.log(`Message sent to ${username} with URL: ${url}`);
    } else {
      console.log(`Unable to find chat ID for username: ${username}`);
    }
  } catch (error) {
    console.error(`Error sending message to ${username}:`, error);
  }
}

async function getChatIdFromUsername(username) {
  // This function should implement the logic to get the chat ID from a username
  // You may need to use Telegram's getChat method or maintain a database of username to chat ID mappings
  // For now, we'll return null as a placeholder
  console.log(`Getting chat ID for username: ${username}`);
  return null;
}

// Set up bot commands
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    "Welcome to the bot! Use /help to see available commands.",
  );
});

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    "Available commands:\n/start - Start the bot\n/help - Show this help message",
  );
});
