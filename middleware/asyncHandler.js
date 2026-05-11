// middleware/asyncHandler.js
const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch((e) =>
        res.status(500).json({ success: false, message: e.message })
    );

module.exports = { asyncHandler };
