const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { Upload } = require('@aws-sdk/lib-storage');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const zlib = require('zlib');

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'ap-south-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const BUCKET = process.env.S3_BUCKET_NAME;

// ─── MIME-type whitelist for compression ─────────────────────────────────────
// Only these text-based formats benefit from gzip. Binary formats like PDF,
// JPEG, PNG, ZIP are already compressed and gzip wastes CPU on them.
const COMPRESSIBLE_MIME_TYPES = new Set([
    'text/plain',
    'text/csv',
    'text/markdown',
    'text/html',
    'text/css',
    'text/xml',
    'application/json',
    'application/xml',
    'application/javascript',
    'application/x-yaml',
    'application/rtf',
]);

/**
 * Check if a MIME type should be compressed before upload.
 * @param {string} mimeType
 * @returns {boolean}
 */
function isCompressible(mimeType) {
    if (!mimeType) return false;
    // Exact match
    if (COMPRESSIBLE_MIME_TYPES.has(mimeType)) return true;
    // Catch text/* subtypes not explicitly listed
    if (mimeType.startsWith('text/')) return true;
    return false;
}

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
 * Upload a file to S3 using streaming (zero memory overhead).
 *
 * If the file's MIME type is compressible, the read stream is piped through
 * gzip before being sent to S3. A running byte tally on the gzip stream
 * dynamically calculates the final compressed size.
 *
 * @param {string} filePath      - Absolute path to the temporary file on disk
 * @param {string} originalName  - Original file name
 * @param {string} mimeType      - File MIME type
 * @param {string} space         - Space type (public, private, organization)
 * @param {string} [orgId]       - Organization ID for org uploads
 * @returns {Promise<{s3Key: string, s3Url: string, isCompressed: boolean, compressedSize: number}>}
 */
async function uploadToS3(filePath, originalName, mimeType, space, orgId) {
    const s3Key = generateS3Key(originalName, space, orgId);
    const shouldCompress = isCompressible(mimeType);

    const readStream = fs.createReadStream(filePath);

    let bodyStream;
    let compressedSize = 0;
    const uploadParams = {
        Bucket: BUCKET,
        Key: s3Key,
        ContentType: mimeType,
    };

    if (shouldCompress) {
        const gzipStream = zlib.createGzip();

        // Track compressed bytes on the fly
        gzipStream.on('data', (chunk) => {
            compressedSize += chunk.length;
        });

        bodyStream = readStream.pipe(gzipStream);
        // NOTE: We intentionally do NOT set Content-Encoding: gzip on S3.
        // The file is stored as raw gzip bytes and decompressed server-side
        // on download, which is more reliable across all HTTP clients.
    } else {
        bodyStream = readStream;
    }

    uploadParams.Body = bodyStream;

    // Use the Upload class for streaming multipart uploads
    const upload = new Upload({
        client: s3Client,
        params: uploadParams,
        // Use 5 MB parts for multipart (default)
        queueSize: 4,
        partSize: 5 * 1024 * 1024,
    });

    await upload.done();

    // For non-compressed uploads, get the file size from disk
    if (!shouldCompress) {
        const stat = fs.statSync(filePath);
        compressedSize = stat.size;
    }

    const s3Url = `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;

    return { s3Key, s3Url, isCompressed: shouldCompress, compressedSize };
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
 * Generate a pre-signed URL for inline preview (Content-Disposition: inline).
 * Browsers will attempt to render supported file types instead of downloading.
 * @param {string} s3Key - S3 object key
 * @param {string} mimeType - MIME type of the file (e.g. 'application/pdf')
 * @param {string} [fileName] - Original file name for the Content-Disposition header
 * @returns {Promise<string>}
 */
async function getPreviewUrl(s3Key, mimeType, fileName) {
    const safeName = (fileName || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
    const command = new GetObjectCommand({
        Bucket: BUCKET,
        Key: s3Key,
        ResponseContentDisposition: `inline; filename="${safeName}"`,
        ResponseContentType: mimeType || 'application/octet-stream',
    });

    return getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

/**
 * Get the raw S3 object (stream + metadata) for proxying downloads.
 * Returns { Body, ContentType, ContentLength, ContentRange, AcceptRanges } from the S3 response.
 * @param {string} s3Key - S3 object key
 * @param {string} [rangeHeader] - Optional Range header for partial content
 * @returns {Promise<import('@aws-sdk/client-s3').GetObjectCommandOutput>}
 */
async function getS3ObjectStream(s3Key, rangeHeader) {
    const params = {
        Bucket: BUCKET,
        Key: s3Key,
    };
    if (rangeHeader) {
        params.Range = rangeHeader;
    }
    const command = new GetObjectCommand(params);

    return s3Client.send(command);
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

module.exports = { uploadToS3, getDownloadUrl, getPreviewUrl, getS3ObjectStream, deleteFromS3, isCompressible };
