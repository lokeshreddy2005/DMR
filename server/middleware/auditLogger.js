const AuditLog = require('../models/AuditLog');

function auditLog(action, entity, extractDetails = (req) => ({})) {
    return async (req, res, next) => {
        // We need to wait for the request to complete to know if it was successful.
        // Express doesn't have an easy "after" middleware, so we hook into res.on('finish')
        
        res.on('finish', async () => {
            // Only log if successful or if it's a specific action we want to track regardless
            if (res.statusCode >= 200 && res.statusCode < 400) {
                try {
                    let entityId = null;
                    if (req.params && req.params.id) entityId = req.params.id;
                    if (res.locals && res.locals.entityId) entityId = res.locals.entityId;

                    const logEntry = new AuditLog({
                        action: action,
                        entity: entity,
                        entityId: entityId,
                        performedBy: req.user._id,
                        role: req.user.role,
                        organizationId: req.user.organizationId,
                        details: extractDetails(req, res),
                        ipAddress: req.ip
                    });
                    await logEntry.save();
                } catch (err) {
                    console.error('Failed to save audit log:', err);
                }
            }
        });
        
        next();
    };
}

module.exports = { auditLog };
