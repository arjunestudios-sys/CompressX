// Passport is no longer used — Google OAuth removed.
// This stub satisfies any lingering require() calls gracefully.
module.exports = {
    initialize: () => (req, res, next) => next(),
    authenticate: () => (req, res, next) => next(),
    use: () => {},
};
