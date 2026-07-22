import mongoose from 'mongoose';

const alertSchema = new mongoose.Schema({
    txId: { type: String, required: true, index: true }, 
    accountId: { type: String, required: true },         
    toAccountId: { type: String, default: null },
    amount: { type: Number, required: true },
    city: { type: String, default: null },
    flags: { type: [String], required: true },
    txTimestamp: { type: Number, required: true },
    verdict:    { type: String, required: true },
    score:      { type: Number, required: true },
    detectedAt: { type: Number, required: true },
}, {
    timestamps: true
});

alertSchema.index({ accountId: 1, txTimestamp: -1 });

const Alert = mongoose.model('Alert', alertSchema);

export { Alert };