import { config } from "dotenv";
  config();
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../MODELS/user.model.js";
import crypto from "crypto"
// Add this at the top of your passport.js file for debugging
// console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID);
// console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET);

// If these log 'undefined', your .env file isn't loading properly

//serialize/deseralize(not used since we issue jwts)
passport.serializeUser((user, done) => {
    done(null, user.id)
})
passport.deserializeUser((id, done) => {
    User.findById(id)
        .then(user => {
            done(null, user)
        }).catch(done)
});


//configure google oauth strategy 
passport.use(new GoogleStrategy({
    
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:5014/api/v1/oauth/google/callback",

},

    async (accessToken, refreshToken, profile, done) => {
        try {
            //extract email and name  photo
            const email = profile.emails[0].value;
            const name     = profile.displayName;                // <-- fixed
    let photoUrl = profile.photos?.[0]?.value || null;
    console.log("Google profile photo URL:", profile.photos?.[0]?.value);


    // Ensure HTTPS
    if (photoUrl && photoUrl.startsWith("http://")) {
      photoUrl = photoUrl.replace("http://", "https://");
    }
        let user = await User.findOne({ email });
            if (!user) {
                user = await User.create({
                    fullName: name,
                    email,
                    password: crypto.randomBytes(16).toString("hex"),
                    avatar: {
                        public_id: profile.id,
                        secure_url: photoUrl
                    },
                    authProvider: "google"
                });
            }
            return done(null, user)
        } catch (error) {
            return done(error, null)
        }
    }
))