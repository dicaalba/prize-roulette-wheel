/**
 * Configuración del Frontend
 * Actualiza API_BASE_URL con la URL de tu Lambda Function URL
 */
const _isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const CONFIG = {
  API_BASE_URL: _isLocal ? '' : 'https://hkhkh8v50h.execute-api.us-east-1.amazonaws.com',
  MEETUP_URL: 'https://www.meetup.com/aws-girls-peru/'
};
