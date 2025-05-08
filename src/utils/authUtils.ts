import Parse from 'parse';

export const getCurrentUser = async (): Promise<Parse.User> => {
  const currentUser = Parse.User.current();
  if (!currentUser) {
    throw new Error('No user logged in');
  }
  return currentUser;
}; 