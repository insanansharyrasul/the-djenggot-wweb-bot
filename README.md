# The Djenggot WhatsApp Web Bot

## Overview
The Djenggot WhatsApp Web Bot is a Node.js application that integrates WhatsApp Web with Firebase Firestore to manage food orders. This bot allows customers to place orders through WhatsApp and stores those orders in a Firestore database.

## Version
Current Version: 1.0.0

## Prerequisites
- Node.js (v14.0.0 or newer)
- npm (v6.0.0 or newer)
- A Firebase project with Firestore database
- Firebase Admin SDK credentials

## Dependencies
- firebase-admin (v13.4.0) - For Firebase integration
- whatsapp-web.js (v1.27.0) - For WhatsApp Web functionality
- qrcode-terminal (v0.12.0) - For generating QR codes in terminal

## Setup and Installation

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/the-djenggot-wweb-bot.git
   cd the-djenggot-wweb-bot
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Firebase Configuration:
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
   - Set up Firestore database
   - Generate a new private key for Firebase Admin SDK
   - Save the JSON credentials file in the project root as `thedjenggot-wweb-firebase-adminsdk-fbsvc-91ccb9f060.json` (or update the path in firebase.js)

## Running the Application

Start the bot:
```
node bot.js
```

When you first run the application, a QR code will be generated in your terminal. Scan this code with your WhatsApp app to link your WhatsApp account to the bot.

## Features

### For Users:
- Interactive order flow through WhatsApp
- Collects user information (name, food order, payment method)

## Usage Flow

1. User initiates a conversation with the bot
2. Bot asks for the user's name
3. Bot collects order details
4. Order is stored in Firestore database

## Development

To modify or extend the bot functionality:
- `bot.js` - Main application with WhatsApp client and message handling
- `firebase.js` - Firebase configuration and database operations

## License

ISC