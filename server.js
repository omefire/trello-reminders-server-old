// Note: http://toon.io/understanding-passportjs-authentication-flow/

const express = require('express');
const passport = require('passport');
const expressSession = require('express-session');

require('dotenv').config({ path: '.env' });

const TrelloStrategy = require('passport-trello').Strategy;

// Note: node-persist uses app memory to save data. 
//       We could run out of memory in the future if there's a lot of request.
//       We might have to move this to something like Redis or Memcached for scalability.
const storage = require('node-persist');
storage.initSync();

const app = express();

const trelloSecret = process.env.TRELLO_SECRET;
const trelloAPIKEY = process.env.TRELLO_API_KEY;
const hostname = process.env.HOSTNAME;
const port = process.env.PORT;


// Note: https://stackoverflow.com/questions/22052258/what-does-passport-session-middleware-do/28994045#28994045
app.use(passport.initialize());
app.use(passport.session()); // Needs serialize/deserialize functions to work correctly


let sess = {
    secret: Math.random().toString(36),
    resave: false,
    saveUninitialized: true,
};

// Only enable secure cookies ( which require HTTPS in order to be set ) if we are in production mode
// This enables us to do testing
if (process.env.NODE_ENV === 'production') {
    // ToDO: Enable this if we are running behind a proxy
    //app.set('trust proxy', 1); 
    
    // TODO: Investigate & Fix this!
    //sess.cookie.secure = true;
}

// Note: https://stackoverflow.com/questions/44071555/why-passport-twitter-requires-session-support
//       https://www.airpair.com/express/posts/expressjs-and-passportjs-sessions-deep-dive
app.use(expressSession(sess));

passport.use(
    new TrelloStrategy({
        consumerKey: trelloAPIKEY,
        consumerSecret: trelloSecret,
        callbackURL: `http://${hostname}:${port}/callback`,
        passReqToCallback: true,
        trelloParams: {
            scope: 'read,account', // TODO: Review this!
            name: 'Trello Reminders',
            expiration: 'never'
        }
    },
        (req, token, tokenSecret, profile, done) => {
            let user = profile;
	    console.log("Profile: " + JSON.stringify(user));
            user.accessToken = token;
            return done(null, user);
        })
);

// Note: https://stackoverflow.com/questions/27637609/understanding-passport-serialize-deserialize
passport.serializeUser((user, done) =>
    storage.setItem(`user_${user.id}`, user)
        .then(() => {
            done(null, user.id)
        })
);

// Note: https://stackoverflow.com/questions/27637609/understanding-passport-serialize-deserialize
passport.deserializeUser((id, done) =>
    done(null, storage.getItem(`user_${user.id}`))
);

app.get('/login', passport.authenticate('trello'),
    (req, res) => {
        res.status(200).send();
    });

app.get('/callback', passport.authenticate('trello', { failureRedirect: '/login' }),
    (req, res) => {
        res.redirect(`trelloreminders://${req.user.accessToken}`);
    });

app.listen(port, '0.0.0.0', () => console.log(`Listening on port ${port}`));
