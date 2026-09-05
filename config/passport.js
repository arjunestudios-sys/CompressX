const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('./db');

const clientID = process.env.GOOGLE_CLIENT_ID || 'dummy_client_id';
const clientSecret = process.env.GOOGLE_CLIENT_SECRET || 'dummy_client_secret';
const callbackURL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback';

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'your_google_client_id_here') {
    passport.use(new GoogleStrategy({
        clientID,
        clientSecret,
        callbackURL
    }, (accessToken, refreshToken, profile, done) => {
        try {
            const googleId = profile.id;
            const email = profile.emails && profile.emails[0] ? profile.emails[0].value : `${googleId}@google.user`;
            const name = profile.displayName || email.split('@')[0];
            const profileImage = profile.photos && profile.photos[0] ? profile.photos[0].value : null;

            let user = db.prepare('SELECT * FROM users WHERE google_id = ? OR email = ?').get(googleId, email);

            if (!user) {
                const result = db.prepare(`
                    INSERT INTO users (name, email, google_id, profile_image)
                    VALUES (?, ?, ?, ?)
                `).run(name, email, googleId, profileImage);
                user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
            } else if (!user.google_id) {
                db.prepare('UPDATE users SET google_id = ?, profile_image = COALESCE(profile_image, ?) WHERE id = ?')
                  .run(googleId, profileImage, user.id);
            }

            return done(null, user);
        } catch (err) {
            return done(err, null);
        }
    }));
}

module.exports = passport;
