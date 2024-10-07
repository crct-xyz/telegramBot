const TelegramBot = require("node-telegram-bot-api");
const AWS = require("aws-sdk");
const axios = require("axios");

// Initialize AWS SDK
const sqs = new AWS.SQS();

// Initialize Telegram bot with webhook
const bot = new TelegramBot('7216921050:AAEISmruLCEXGap4zLcpDyzGyLKWTIBq2SU', {
  webHook: true,
});

bot.setWebHook('https://bketuxt5md.execute-api.eu-central-1.amazonaws.com/TelegramBot');
const dbUrl = 'http://ec2-52-59-228-70.eu-central-1.compute.amazonaws.com:8000/telegram/'
const notificationQueueUrl = 'https://sqs.eu-central-1.amazonaws.com/816069166828/NotificationQueue';
const actionBuilderURL = "https://sqs.eu-central-1.amazonaws.com/816069166828/action-builder-q";
const actionsDbURL = "http://ec2-52-59-228-70.eu-central-1.compute.amazonaws.com:8000/actions/";


let username;
let recipients;
// get blink url and telegram username from the notification sqs
// async function receiveSQSMessages() {
//   const params = {
//     QueueUrl: notificationQueueUrl,
//     MaxNumberOfMessages: 10,
//     WaitTimeSeconds: 5,
//   };

//   try {
//     const result = await sqs.receiveMessage(params).promise();

//     if (result.Messages && result.Messages.length > 0) {
//       for (const message of result.Messages){
//         const receivedMessage = message;
//         console.log("Message received:", receivedMessage);

//         // Process the message
//         console.log("Message Body:", receivedMessage.Body);
//         const bodyJSON = JSON.parse(receivedMessage.Body)
//         console.log("receiptHandle: ", message.ReceiptHandle)
//         username = bodyJSON.sendData.telegram_user;
//         blink_url = bodyJSON.sendData.blinkUrl
//         console.log("username: ", username)
//         console.log("blink URL: ", blink_url);
//         await deleteMessage(message.ReceiptHandle);
//       };
//     } else {
//       console.log("No messages to process.");
//     }
//   } catch (error) {
//     console.log("error: ", error);
//   }
// }

async function deleteMessage(receiptHandle) {
  const deleteParams = {
    QueueUrl: actionBuilderURL,
    ReceiptHandle: receiptHandle,
  };

  try {
    await sqs.deleteMessage(deleteParams).promise();
    console.log("Message deleted successfully: ", receiptHandle);
  } catch (error) {
    console.error("Error deleting message:", error);
  }
}


// Main Lambda handler
exports.handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));
  // await receiveSQSMessages();

  for (const record of event.Records) {
    const parsedRecord = JSON.parse(record.body)
    console.log("parsed record: ", parsedRecord)
    recipients = parsedRecord.Recipients
    userId = parsedRecord.User_ID
    await deleteMessage(record.receiptHandle)
    console.log("message deleted: ", record.messageId)
  }

  const response = await axios.get(dbUrl);
  const data = response.data;

  // get the action based on the action id
  // const res = await axios.get(actionsDbURL);
  const actionID = 7
  const blink_url = `https://dial.to/?action=solana-action%3Ahttps://squint-api.vercel.app/actions/${actionID}`

  for (const item of data) {
    if (item.telegram_user === recipients) {
      const chatId = item.session_id;
      await bot.sendMessage(chatId, `NOW WE WORK ON THE USDC CASE, but for now here's your blink. ENJOY ${blink_url}`);
    }
  }

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

  if (update.message && update.message.text === "/start") {
    const chatId = update.message.chat.id;
    const response = await axios.get(dbUrl);
    const data = response.data;
    for (item of data) {
      if (item.session_id === chatId) {
        console.log("session ID already present in json")
      }
      else {
        const postData = {
          telegram_user: update.message.chat.username,
          session_id: update.message.chat.id
        }
        axios.post(dbUrl, postData, {
          headers: {
            'Content-Type': 'application/json' // Set the header to specify JSON content
          }
        })
        .then(response => {
          console.log('Success:');
        })
        .catch(error => {
          console.error('Error:', error);
        });
      }
    }
    await bot.sendMessage(chatId, `Bot has started. there was something wrong with onText. anyways. data = ${data}`);
    return;
  }

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
// bot.onText(/\/start/, (msg) => {
//   const chatId = msg.chat.id;
//   bot.sendMessage(
//     chatId,
//     "Welcome to the bot! Use /help to see available commands.",
//   );
// });

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    "Available commands:\n/start - Start the bot\n/help - Show this help message",
  );
});