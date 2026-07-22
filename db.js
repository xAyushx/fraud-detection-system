import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/fraud_engine';

async function connectDB() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log(`[MongoDB] connected -> ${MONGO_URI}`);
    } catch (err) {
        console.error('[MongoDB] connection failed, continuing without persistence:', err.message);
    }
}

function isDbConnected() {
    return mongoose.connection.readyState === 1;
}

export { connectDB, isDbConnected };