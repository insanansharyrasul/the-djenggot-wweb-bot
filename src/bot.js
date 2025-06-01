const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const {
    initializeFirebaseApp,
    getFirestoreDb,
    FieldValue
} = require('./firebase.js');

try {
    console.log("Initializing Firebase app...");
    initializeFirebaseApp();
    console.log("Firebase app initialized successfully");
    const db = getFirestoreDb();
    console.log("Firestore database connected successfully");

    db.collection('orders').limit(1).get()
        .then(() => console.log("Firestore connection test successful"))
        .catch(err => console.error("Firestore connection test failed:", err));



} catch (error) {
    console.error("Failed to initialize Firebase:", error);
    process.exit(1);
}

const db = getFirestoreDb();

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox']
    }
});


function setupOrderStatusListeners() {

    console.log("Setting up order status listeners...");
    const latestOrdersByPhone = new Map();

    db.collection('orders')
        .orderBy('timestamp', 'desc')
        .get()
        .then(snapshot => {
            const processedPhones = new Set();

            snapshot.forEach(doc => {
                const order = doc.data();
                if (order.phoneNumber && !processedPhones.has(order.phoneNumber)) {
                    latestOrdersByPhone.set(order.phoneNumber, doc.id);
                    processedPhones.add(order.phoneNumber);
                    console.log(`Set latest order for ${order.phoneNumber} to ${doc.id}`);
                }
            });

            console.log(`Initialized latest orders for ${latestOrdersByPhone.size} phone numbers`);

            db.collection('orders')
                .onSnapshot(snapshot => {
                    console.log(`Snapshot received with ${snapshot.docChanges().length} changes`);

                    snapshot.docChanges().forEach(async change => {
                        if (change.type === 'modified') {
                            const order = change.doc.data();
                            const orderId = change.doc.id;

                            if (order.phoneNumber && latestOrdersByPhone.get(order.phoneNumber) === orderId) {
                                console.log(`Processing latest order update: ${orderId}, Status: ${order.status}`);

                                try {
                                    const customerNumber = `${order.phoneNumber}@c.us`;
                                    console.log(`Sending notification to: ${customerNumber}`);

                                    await client.sendMessage(customerNumber,
                                        `Status pesanan terbaru Anda telah diperbarui!\n` +
                                        `*Order ID*: ${orderId}\n` +
                                        `*Status baru*: ${order.status}`);

                                    console.log(`Notification sent successfully to ${customerNumber}`);
                                } catch (error) {
                                    console.error(`Failed to send message: ${error.message}`);
                                }
                            } else {
                                console.log(`Skipping notification for non-latest order: ${orderId}`);
                            }
                        } else if (change.type === 'added') {
                            const order = change.doc.data();
                            if (order.phoneNumber) {
                                latestOrdersByPhone.set(order.phoneNumber, change.doc.id);
                                console.log(`Updated latest order for ${order.phoneNumber} to ${change.doc.id}`);
                            }
                        }
                    });
                }, error => {
                    console.error('Error in order status listener:', error);
                });
        })
        .catch(error => {
            console.error('Error initializing latest orders:', error);
        });
}

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('QR Code generated. Scan it with your WhatsApp app.');
});

client.on('disconnected', (reason) => {
    console.log('Client was logged out:', reason);
    setTimeout(() => {
        console.log('Attempting to reconnect...');
        client.initialize();
    }, 5000);
});

client.on('auth_failure', (session) => {
    console.log('Authentication failed:', session);
});

client.on('authenticated', () => {
    console.log('Client authenticated successfully');
});

client.on('loading_screen', (percent, message) => {
    process.stdout.write(`\rLoading: ${percent}% - ${message}`);
    if (percent === 100) {
        console.log(''); // Add final newline
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    client.destroy().then(() => {
        process.exit(1);
    });
});

client.on('ready', () => {
    console.log('Client is ready!');
    setupOrderStatusListeners();
});

const userStates = new Map();

client.on('message', async (message) => {
    const chat = await message.getChat();

    if (chat.isGroup) {
        return;
    }

    const userId = message.from;
    const messageText = message.body.trim().toLowerCase();

    if (messageText === '!status') {
        try {
            const phoneNumber = userId.split('@')[0];
            const snapshot = await db.collection('orders')
                .where('phoneNumber', '==', phoneNumber)
                .orderBy('timestamp', 'desc')
                .limit(1)
                .get();

            if (snapshot.empty) {
                await chat.sendMessage('Tidak ada pesanan yang tersimpan untuk nomor ini.');
                return;
            }

            const orderDoc = snapshot.docs[0];
            const order = orderDoc.data();
            const timestamp = order.timestamp
                ? new Date(order.timestamp.toDate()).toLocaleString('id-ID')
                : 'Waktu tidak tersedia';

            let statusMessage = `*ID:* ${orderDoc.id}\n`;
            statusMessage += `*Nama:* ${order.nama}\n`;
            statusMessage += `*Makanan:* ${order.makanan}\n`;
            statusMessage += `*Pembayaran:* ${order.pembayaran}\n`;
            statusMessage += `*Waktu:* ${timestamp}\n`;
            statusMessage += `*No. HP:* ${order.phoneNumber || 'Tidak tersedia'}\n`;
            statusMessage += `*Status:* ${order.status || 'Tidak tersedia'}\n`;
            statusMessage += `*Pesanan ID:* ${orderDoc.id}\n`;

            await chat.sendMessage(`*Status Pesanan Terakhir:*\n\n${statusMessage}`);
            return;
        } catch (error) {
            console.error('Error fetching orders:', error);
            await chat.sendMessage('Terjadi kesalahan saat mengambil status pesanan.');
            return;
        }
    }

    // Command to start the ordering process
    if (messageText === '!pesan') {
        if (!userStates.has(userId)) {
            userStates.set(userId, {
                step: 'start',
                orderData: {
                    nama: '',
                    makanan: '',
                    pembayaran: '',
                }
            });
        }

        const userState = userStates.get(userId);
        userState.step = 'start';

        await chat.sendMessage('Selamat datang di Bot Pesanan The Djenggot!\n\n' +
            'Silakan masukkan nama pemesan:');
        userState.step = 'nama';
        return;
    }

    if (!userStates.has(userId) || userStates.get(userId).step === 'start') {
        await chat.sendMessage('Selamat datang di Bot Pesanan The Djenggot!\n\n' +
            'Ketik *!pesan* untuk memulai pemesanan.\n' +
            'Ketik *!status* untuk melihat status pesanan terakhir Anda.');
        return;
    }

    const userState = userStates.get(userId);

    if (messageText.startsWith('!') && userState.step !== 'start') {
        if (messageText === '!pesan' || messageText === '!status') {
            return;
        } else {
            await chat.sendMessage('Maaf, Anda sedang dalam proses pemesanan. Silakan selesaikan pemesanan terlebih dahulu atau ketik *!cancel* untuk membatalkan.');
            return;
        }
    }

    switch (userState.step) {
        case 'start':
            await chat.sendMessage('Maaf saya masih belum memiliki fitur itu.');
            break;

        case 'nama':
            userState.orderData.nama = message.body;
            await chat.sendMessage('Makanan yang dipesan:');
            userState.step = 'makanan';
            break;

        case 'makanan':
            userState.orderData.makanan = message.body;
            await chat.sendMessage('Metode pembayaran:');
            userState.step = 'pembayaran';
            break;

        case 'pembayaran':
            userState.orderData.pembayaran = message.body;

            const orderJson = {
                nama: userState.orderData.nama,
                makanan: userState.orderData.makanan,
                pembayaran: userState.orderData.pembayaran,
                timestamp: FieldValue.serverTimestamp(),
                phoneNumber: userId.split('@')[0],
                status: 'pending'
            }

            try {
                const docRef = await db.collection('orders').add(orderJson);
                console.log('Order saved to Firestore with ID: ', docRef.id);

                let orderStatusMessage = `Pesanan Anda telah diterima!\n\n`;
                orderStatusMessage += `*Nama Pemesan*: ${userState.orderData.nama}\n`;
                orderStatusMessage += `*Makanan yang dipesan*: ${userState.orderData.makanan}\n`;
                orderStatusMessage += `*Pembayaran*: ${userState.orderData.pembayaran}\n`;
                orderStatusMessage += `*Order ID*: ${docRef.id}\n\n`;
                orderStatusMessage += `Silakan tunggu konfirmasi dari kami.\n\n` +
                    `Jika Anda ingin memeriksa status pesanan Anda, silakan ketik *!status*`;
                await chat.sendMessage(orderStatusMessage);
            } catch (error) {
                console.error('Error saving order to Firestore:', error);
                await chat.sendMessage('Terjadi kesalahan saat menyimpan pesanan. Silakan coba lagi.');
            }

            userStates.delete(userId);
            break;

        default:
            await chat.sendMessage('Maaf saya masih belum memiliki fitur itu.');
            break;
    }
});

client.initialize(); 