import config from '../../config/default.js';

// Fonction utilitaire pour détecter si c'est une requête API
const isApiRequest = (req) => {
  // Vérifie si l'URL commence par /api
  if (req.path.startsWith('/api')) return true;

  // Vérifie si c'est une requête XHR/AJAX
  if (req.xhr) return true;

  // Vérifie les en-têtes Accept
  const acceptHeader = req.get('Accept') || '';
  if (acceptHeader.includes('application/json')) return true;

  // Par défaut, considérer comme une requête de vue
  return false;
};

// Gestionnaire d'erreurs pour les API
const handleApiErrors = (err, _req, res) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Une erreur inattendue s'est produite";

  const errorDetails =
    config.app.environment === "development"
      ? {
        stack: err.stack,
        error: err,
      }
      : undefined;

  res.status(statusCode).json({
    status: "error",
    statusCode,
    message,
    ...(errorDetails && { details: errorDetails }),
  });

  console.error(`[API Error] ${message}`, err);
};

// Gestionnaire d'erreurs pour les vues
const handleViewErrors = (err, req, res) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Une erreur inattendue s'est produite";

  // Utiliser les données d'erreur ou les valeurs par défaut
  const user = err.user || req.session?.user || {};
  const order = err.order || req.order || { length: 0 };

  // Rendu de la page d'erreur
  res.status(statusCode).render('error', {
    message,
    statusCode,
    user,
    order,
    ...(config.app.environment === "development" && {
      stack: err.stack,
      details: err
    })
  });

  console.error(`[View Error] ${message}`, err);
};

// Middleware pour détecter si la requête est une API ou une vue
const handleErrors = (err, req, res) => {
  if (isApiRequest(req)) {
    return handleApiErrors(err, req, res);
  }
  return handleViewErrors(err, req, res);
};

// Gestionnaire 404 pour les API
const handleApi404 = (_req, res) => {
  res.status(404).json({
    status: "error",
    statusCode: 404,
    message: "Resource not found",
  });
};

// Gestionnaire 404 pour les vues
const handleView404 = (req, res) => {
  const user = req.session?.user || {};
  const order = req.order || { length: 0 };

  res.status(404).render('error', {
    message: "Page non trouvée",
    statusCode: 404,
    user,
    order
  });
};

// Middleware pour gérer les 404
const handle404 = (req, res) => {
  if (isApiRequest(req)) {
    return handleApi404(req, res);
  }
  return handleView404(req, res);
};

export { handleErrors, handle404 };