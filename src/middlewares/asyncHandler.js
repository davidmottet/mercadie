// Wrapper pour gérer les erreurs des fonctions asynchrones dans les API
const asyncApiHandler = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (error) {
    // Si l'erreur n'a pas de code HTTP, on met 500 par défaut
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

export { asyncApiHandler };