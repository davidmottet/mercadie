import Parse from 'parse';
import './parseModels';

// Initialize Parse
Parse.initialize(
  import.meta.env.VITE_PARSE_APP_ID,
  import.meta.env.VITE_PARSE_JAVASCRIPT_KEY
);

// Using the standard Parse server URL format
Parse.serverURL = import.meta.env.VITE_PARSE_SERVER_URL;

// Enable cookie-based authentication
Parse.User.enableUnsafeCurrentUser();
Parse.User.enableRevocableSession();

// Set cookie domain to allow sharing between subdomains
const domain = window.location.hostname.split('.').slice(-2).join('.');
Parse.CoreManager.set('COOKIE_DOMAIN', domain);

// Configure Parse to use revocable sessions
Parse.CoreManager.set('REQUEST_HEADERS', {
  'X-Parse-Revocable-Session': '1'
});

export default Parse;