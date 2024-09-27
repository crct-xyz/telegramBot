const TelegramBot = require("node-telegram-bot-api");
const { Connection, PublicKey, clusterApiUrl } = require("@solana/web3.js");

// Initialize Telegram bot with webhook
const bot = new TelegramBot("7216921050:AAEISmruLCEXGap4zLcpDyzGyLKWTIBq2SU", {
  webHook: true,
});
bot.setWebHook(
  "https://bketuxt5md.execute-api.eu-central-1.amazonaws.com/TelegramBot"
);

// Initialize Solana connection
const connection = new Connection(clusterApiUrl("mainnet-beta"));
let multisigPda;
const subscribers = new Set();

// Main Lambda handler
exports.handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  if (!event.body) {
    console.log("body not provided");
  }
  
  const update = JSON.parse(event.body);
  await bot.processUpdate(update);

  async function checkTransactions() {
    if (!multisigPda) {
      console.error("Multisig PDA not set. Please use /setMultisig to set it.");
      return;
    }
    let lastCheckedSignature;
    const signatures = await connection.getSignaturesForAddress(multisigPda, {
      limit: 5,
    });
    console.log(signatures);
    for (const sigInfo of signatures) {
      if (sigInfo.signature === lastCheckedSignature) {
        break;
      }
      if (sigInfo.confirmationStatus === "finalized") {
        const message = `new transaction detected: \nSignature: ${sigInfo.signature}\nSlot: ${sigInfo.slot}\nVote for the transaction here: https://dial.to/?action=solana-action%3Ahttp://localhost:3000/api/actions/squad/vote?address=${multisigPda}`;
        lastCheckedSignature = sigInfo.signature;
        sendTelegramMessage(message);
        break;
      }
    }
  }
  function sendTelegramMessage(message) {
    if (subscribers.length === 0) {
        console.log("subscribers array empty");
        return;
    }
    subscribers.forEach((chatId) => {
      bot.sendMessage(chatId, message);
    });
  }

  if (event.source && event["detail-type"]) {
    // Event is coming from EventBridge
    console.log("Event is from EventBridge");
    await checkTransactions();
  }


  // Handle specific commands (e.g., /start) here
  if (update.message && update.message.text === "/start") {
    const chatId = update.message.chat.id;
    subscribers.add(chatId);
    console.log(subscribers);
    await bot.sendMessage(chatId, "Bot has started");
    return;
  }
  if (update.message && update.message.text.startsWith("/setMultisig ")) {
    const chatId = update.message.chat.id;

    // Extract the multisig address from the message
    const parts = update.message.text.split(" ");
    if (parts.length === 2) {
      const multisigAddress = parts[1];

      // Validate the address (basic length check for a Solana address)
      if (multisigAddress.length === 44) {
        // Solana addresses are typically 44 characters long
        multisigPda = new PublicKey(multisigAddress);
        await bot.sendMessage(
          chatId,
          `Multisig address set successfully: ${multisigPda.toBase58()}`
        );
      } else {
        await bot.sendMessage(
          chatId,
          "Invalid address. Please provide a valid Solana multisig address."
        );
      }
    } else {
      await bot.sendMessage(chatId, "Usage: /setMultisig <address>");
    }
  }

  await checkTransactions();

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Webhook received" }),
  };
};
