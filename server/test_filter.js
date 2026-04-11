const mongoose = require('mongoose');

async function testQuery() {
  await mongoose.connect('mongodb+srv://lokeshreddybolla8025_db_user:cYeGt1HHSVvTYct1@cluster1.du8k8mk.mongodb.net/?appName=Cluster1');
  const Document = mongoose.model('Document', new mongoose.Schema({}, { strict: false }));

  // Simulate parameters
  const extension = ".pdf";
  const filterQuery = {};
  
  if (extension) {
    const extLower = extension.toLowerCase().startsWith('.')
      ? extension.toLowerCase()
      : `.${extension.toLowerCase()}`;
        
    // Ensure literal dot is escaped properly, preventing double escaping bugs:
    const escapedExt = extLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const extRegex = new RegExp(`${escapedExt}$`, 'i');

    const MIME_MAP = {
      '.pdf':  ['application/pdf'],
      '.doc':  ['application/msword'],
      '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      '.xls':  ['application/vnd.ms-excel'],
      '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      '.ppt':  ['application/vnd.ms-powerpoint'],
      '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
      '.txt':  ['text/plain'],
      '.png':  ['image/png'],
      '.jpg':  ['image/jpeg'],
      '.jpeg': ['image/jpeg'],
      '.gif':  ['image/gif'],
      '.mp4':  ['video/mp4'],
      '.mp3':  ['audio/mpeg'],
      '.zip':  ['application/zip', 'application/x-zip-compressed'],
    };
    const mimeTypes = MIME_MAP[extLower] || [];

    const extConditions = [
      { 'metadata.extension': extLower },  // new docs
      { fileName: extRegex },               // old docs with extension in name
    ];
    if (mimeTypes.length > 0) {
      extConditions.push({ mimeType: { $in: mimeTypes } }); // old docs matched by mime
    }

    filterQuery.$and = [
      ...(filterQuery.$and || []),
      { $or: extConditions }
    ];
  }

  // Basic accessQuery substitute (just finding any for the test)
  const finalQuery = Object.keys(filterQuery).length > 0
    ? { $and: [{}, filterQuery] }
    : {};

  console.log("Final Query:", JSON.stringify(finalQuery, function(key, val) {
    if (val instanceof RegExp) return val.toString();
    return val;
  }, 2));

  const docs = await Document.find(finalQuery).limit(10);
  console.log("Matched Docs:", docs.length);
  docs.forEach(d => console.log(`- ${d.fileName} [${d.mimeType || 'none'}] [${d.metadata?.extension || 'none'}]`));

  mongoose.disconnect();
}
testQuery();
