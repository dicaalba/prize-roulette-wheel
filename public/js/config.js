/**
 * Frontend Configuration
 * When deployed on GitHub Pages, set API_BASE_URL to your Lambda Function URL
 * When running locally, leave as empty string (same-origin)
 */
const CONFIG = {
  // Set this to your Lambda Function URL when deploying frontend to GitHub Pages
  // Example: 'https://abc123.lambda-url.us-east-1.on.aws'
  // Leave empty for local development (same-origin)
  API_BASE_URL: '',
  
  // WebSocket URL (only works with standalone server, not Lambda)
  // Leave empty to auto-detect from current host
  WS_URL: '',
  
  // Meetup URL
  MEETUP_URL: 'https://www.meetup.com/aws-girls-peru/'
};
