const TelegramBot = require("node-telegram-bot-api");
const AWS = require("aws-sdk");
const axios = require("axios");

// initializing the sqs client
const sqs = new AWS.SQS({ region: "eu-central-1" });

// setting up the telegram bot
const bot = new TelegramBot("7216921050:AAEISmruLCEXGap4zLcpDyzGyLKWTIBq2SU", {
  webHook: true,
});
bot.setWebHook(
  "https://bketuxt5md.execute-api.eu-central-1.amazonaws.com/TelegramBot"
);

// setting up the dbs
const telegramDb = "https://squint-api.vercel.app/telegram/";
const actionsDbURL = "https://squint-api.vercel.app/actions/";
const orderDb = "https://squint-api.vercel.app/orders/";

// setting up the sqs services
const notificationQueueUrl =
  "https://sqs.eu-central-1.amazonaws.com/816069166828/NotificationQueue";
const actionBuilderURL =
  "https://sqs.eu-central-1.amazonaws.com/816069166828/action-builder-q";

// initializing variables
let username;
let recipients;
let transaction_number;
let orderID;
let actionID;
let vaultID;
let tgUsername;
let amount;
let userId;

// function to delete message from the action builder queue
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

// function to get chat id from the username mentioned in the order
async function getChatIdFromUsername(username) {
  const tgResponse = await axios.get(telegramDb);
  const tgUsersData = tgResponse.data;

  for (const user of tgUsersData) {
    if (user.telegram_user === username) {
      return user.session_id;
    }
  }

  return Response.json({ message: "session id not found" });
}

// function to send message to the user
async function sendMessageToUser(username, message) {
  try {
    const chatId = await getChatIdFromUsername(username);
    if (chatId) {
      await bot.sendMessage(chatId, message);
    }
  } catch (error) {
    console.log("error: ", error);
  }
}

// function to post data to the telegram db
async function postDataToTgDb(username, chatId) {
  const postData = {
    telegram_user: username,
    session_id: chatId,
  };

  axios
    .post(telegramDb, postData, {
      headers: {
        "Content-Type": "application/json",
      },
    })
    .then((response) => {
      console.log("Success: ", response);
    })
    .catch((error) => {
      console.error("Error:", error);
    });
}
// function to handle telegram updates from the user chats
async function handleTelegramUpdate(body) {
  console.log("body: ", body);
  const update = JSON.parse(body);
  await bot.processUpdate(update);

  // handling specific bot commands
  if (update.message && update.message.text === "/start") {
    const chatId = update.message.chat.id;
    const username = update.message.chat.username;

    const response = await axios.get(dbUrl);
    const data = response.data;
    for (item of data) {
      if (item.session_id === chatId) {
        console.log("session ID already present in json");
      } else {
        await postDataToTgDb(username, chatId);
      }
    }
    await bot.sendMessage(chatId, `Bot has started`);
    return;
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Telegram update processed successfully" }),
  };
}

// main lambda handler
exports.handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  if (event.Records) {
    // parsing from the records received by the sqs
    for (const record of event.Records) {
      const parsedRecord = JSON.parse(record.body);
      console.log("parsed record: ", parsedRecord);
      recipients = parsedRecord.Recipients;
      tgUsername = parsedRecord.Tg_Username;
      amount = parsedRecord.Amount;
      userId = parsedRecord.User_ID;
      transaction_number = parsedRecord.Transaction_Index;
      orderID = parsedRecord.Order_id;
      vaultID = parsedRecord.Vault_ID;
      actionID = parsedRecord.Action_ID;

      await deleteMessage(record.receiptHandle);
      console.log("message deleted: ", record.messageId);

      const blink_url = `https://dial.to/?action=solana-action%3Ahttps://squint-api.vercel.app/actions/${actionID}`;

      if (recipients) {
        const message = `crct sent you a blink for reviewing\nTransaction number: ${transaction_number}\n${blink_url}`;
        await sendMessageToUser(recipients, message);
      } else if (tgUsername) {
        const message = `${tgUsername} has requested ${amount} usdc from you\n${blink_url}`;
        await sendMessageToUser(tgUsername, message);
      }
    }
  } else if (event.body) {
    return handleTelegramUpdate(event.body);
  }

  return Response.json({ message: "message sent successfully" });
};
