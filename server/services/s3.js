const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const path = require('path');
const crypto = require('crypto');

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'ap-south-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const BUCKET = process.env.S3_BUCKET_NAME;

/**
 * Generates a unique S3 key for a file.
 * Format: uploads/<space>/<year>/<month>/<uuid>-<filename>
 */
function generateS3Key(originalName, space, orgId) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const uuid = crypto.randomUUID();
    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const prefix = orgId ? `organizations/${orgId}` : space;
    return `uploads/${prefix}/${year}/${month}/${uuid}-${safeName}`;
}

/**
 * Upload a file buffer to S3.
 * @param {Buffer} fileBuffer - File contents
 * @param {string} originalName - Original file name
 * @param {string} mimeType - File MIME type
 * @param {string} space - Space type (public, private, organization)
 * @param {string} [orgId] - Organization ID for org uploads
 * @returns {Promise<{s3Key: string, s3Url: string}>}
 */
async function uploadToS3(fileBuffer, originalName, mimeType, space, orgId) {
    const s3Key = generateS3Key(originalName, space, orgId);

    const command = new PutObjectCommand({
        Bucket: BUCKET,
        Key: s3Key,
        Body: fileBuffer,
        ContentType: mimeType,
    });

    await s3Client.send(command);

    const s3Url = `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;

    return { s3Key, s3Url };
}

/**
 * Generate a pre-signed download URL (expires in 1 hour).
 * @param {string} s3Key - S3 object key
 * @returns {Promise<string>}
 */
async function getDownloadUrl(s3Key) {
    const command = new GetObjectCommand({
        Bucket: BUCKET,
        Key: s3Key,
    });

    return getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

/**
 * Delete a file from S3.
 * @param {string} s3Key - S3 object key
 */
async function deleteFromS3(s3Key) {
    const command = new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: s3Key,
    });

    await s3Client.send(command);
}

module.exports = { uploadToS3, getDownloadUrl, deleteFromS3 };
