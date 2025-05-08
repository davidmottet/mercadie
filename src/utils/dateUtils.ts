export const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export const formatReadableDate = (dateString: string): string => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
};

export const getNextDay = (dateString: string): string => {
  const date = new Date(dateString);
  date.setDate(date.getDate() + 1);
  return formatDate(date);
};

export const getPrevDay = (dateString: string): string => {
  const date = new Date(dateString);
  date.setDate(date.getDate() - 1);
  return formatDate(date);
};