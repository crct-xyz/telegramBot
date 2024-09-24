const TelegramBot = require('node-telegram-bot-api');
const { Connection, PublicKey, clusterApiUrl } = require('@solana/web3.js');

// Initialize Telegram bot with webhook
const bot = new TelegramBot('7216921050:AAEISmruLCEXGap4zLcpDyzGyLKWTIBq2SU', { webHook: true });
bot.setWebHook('https://bketuxt5md.execute-api.eu-central-1.amazonaws.com/TelegramBot')

// Initialize Solana connection
const connection = new Connection(clusterApiUrl('mainnet-beta'));
let multisigPda;

// Main Lambda handler
exports.handler = async (event) => {
    console.log("Event received:", JSON.stringify(event, null, 2));

    try {
        // Ensure event.body exists
        if (!event.body) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'Invalid request: No body provided' }),
            };
        }

        // Parse incoming Telegram update
        const update = JSON.parse(event.body);

        // Process the Telegram update directly
        await bot.processUpdate(update);

        // Handle specific commands (e.g., /start) here
        if (update.message && update.message.text === '/start') {
            const chatId = update.message.chat.id;
            await bot.sendMessage(chatId, 'Bot started.');
        }
        if (update.message && update.message.text.startsWith('/setMultisig ')) {
            const chatId = update.message.chat.id;

            // Extract the multisig address from the message
            const parts = update.message.text.split(' ');
            if (parts.length === 2) {
                const multisigAddress = parts[1];

                // Validate the address (basic length check for a Solana address)
                if (multisigAddress.length === 44) { // Solana addresses are typically 44 characters long
                    multisigPda = new PublicKey(multisigAddress);
                    await bot.sendMessage(chatId, `Multisig address set successfully: ${multisigPda.toBase58()}`);
                } else {
                    await bot.sendMessage(chatId, 'Invalid address. Please provide a valid Solana multisig address.');
                }
            } else {
                await bot.sendMessage(chatId, 'Usage: /setMultisig <address>');
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Webhook received' }),
        };
    } catch (error) {
        console.error("Error processing event:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Internal Server Error', error: error.message }),
        };
    }
};
