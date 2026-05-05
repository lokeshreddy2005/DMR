const cron = require('node-cron');
const Document = require('../models/Document');
const { deleteFromS3 } = require('./s3');

// Run every day at 2:00 AM
cron.schedule('0 2 * * *', async () => {
    console.log('Running daily trash purge job...');
    
    // 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    try {
        const expiredDocuments = await Document.find({
            isTrashed: true,
            trashedAt: { $lte: thirtyDaysAgo }
        });

        if (expiredDocuments.length === 0) {
            console.log('No expired trash to purge.');
            return;
        }

        console.log(`Found ${expiredDocuments.length} document(s) to permanently delete.`);

        for (const doc of expiredDocuments) {
            try {
                // Delete from S3
                await deleteFromS3(doc.s3Key);
                // Delete from Database
                await Document.findByIdAndDelete(doc._id);
                console.log(`Permanently deleted document: ${doc.fileName}`);
            } catch (err) {
                console.error(`Failed to delete document ${doc._id}:`, err.message);
            }
        }

        console.log('Trash purge job completed.');
    } catch (error) {
        console.error('Error during trash purge job:', error.message);
    }
});
