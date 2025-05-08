import { AppState, DailyLog, NutritionGoal } from '../types';

const STORAGE_KEY = 'nutrition-tracker-data';

const defaultNutritionGoals: NutritionGoal[] = [
  {
    id: 'water',
    name: 'Eau',
    current: 0,
    target: {
      health: 2.5,
      diet: 2.5
    },
    unit: 'L',
    color: 'blue'
  },
  {
    id: 'calories',
    name: 'Calories',
    current: 0,
    target: {
      health: 2000,
      diet: 1800
    },
    unit: 'kcal',
    color: 'orange'
  },
  {
    id: 'protein',
    name: 'Protéines',
    current: 0,
    target: {
      health: 60,
      diet: 90
    },
    unit: 'g',
    color: 'red'
  },
  {
    id: 'carbs',
    name: 'Glucides',
    current: 0,
    target: {
      health: 250,
      diet: 150
    },
    unit: 'g',
    color: 'yellow'
  },
  {
    id: 'fat',
    name: 'Lipides',
    current: 0,
    target: {
      health: 70,
      diet: 50
    },
    unit: 'g',
    color: 'purple'
  }
];

export const getInitialState = (): AppState => {
  const today = new Date().toISOString().split('T')[0];
  
  try {
    const savedData = localStorage.getItem(STORAGE_KEY);
    
    if (savedData) {
      const parsedData = JSON.parse(savedData);
      // Assurez-vous que les données sauvegardées ont la bonne structure
      if (!parsedData.dailyLogs[today]) {
        parsedData.dailyLogs[today] = {
          date: today,
          nutritionGoals: [...defaultNutritionGoals],
          activeMode: parsedData.dailyLogs[Object.keys(parsedData.dailyLogs)[0]]?.activeMode || 'health'
        };
      }
      return parsedData;
    }
  } catch (error) {
    console.error('Error loading data from localStorage:', error);
  }
  
  return {
    currentDate: today,
    dailyLogs: {
      [today]: {
        date: today,
        nutritionGoals: [...defaultNutritionGoals],
        activeMode: 'health'
      }
    }
  };
};

export const saveState = (state: AppState): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Error saving data to localStorage:', error);
  }
};

export const getDailyLog = (state: AppState, date: string): DailyLog => {
  if (!state.dailyLogs[date]) {
    const previousDay = new Date(date);
    previousDay.setDate(previousDay.getDate() - 1);
    const previousDayStr = previousDay.toISOString().split('T')[0];
    const previousMode = state.dailyLogs[previousDayStr]?.activeMode || 'health';

    return {
      date,
      nutritionGoals: [...defaultNutritionGoals],
      activeMode: previousMode
    };
  }
  
  return state.dailyLogs[date];
};

export const updateNutritionGoal = (
  state: AppState,
  date: string,
  goalId: string,
  amount: number
): AppState => {
  const dailyLog = getDailyLog(state, date);
  
  const updatedGoals = dailyLog.nutritionGoals.map(goal => {
    if (goal.id === goalId) {
      const newValue = Math.max(0, goal.current + amount);
      return { ...goal, current: newValue };
    }
    return goal;
  });
  
  const updatedDailyLog = {
    ...dailyLog,
    nutritionGoals: updatedGoals
  };
  
  const updatedState = {
    ...state,
    dailyLogs: {
      ...state.dailyLogs,
      [date]: updatedDailyLog
    }
  };
  
  saveState(updatedState);
  return updatedState;
};

export const resetNutritionGoal = (
  state: AppState,
  date: string,
  goalId: string
): AppState => {
  const dailyLog = getDailyLog(state, date);
  
  const updatedGoals = dailyLog.nutritionGoals.map(goal => {
    if (goal.id === goalId) {
      return { ...goal, current: 0 };
    }
    return goal;
  });
  
  const updatedDailyLog = {
    ...dailyLog,
    nutritionGoals: updatedGoals
  };
  
  const updatedState = {
    ...state,
    dailyLogs: {
      ...state.dailyLogs,
      [date]: updatedDailyLog
    }
  };
  
  saveState(updatedState);
  return updatedState;
};

export const toggleNutritionMode = (
  state: AppState,
  date: string
): AppState => {
  const dailyLog = getDailyLog(state, date);
  
  const updatedDailyLog = {
    ...dailyLog,
    activeMode: dailyLog.activeMode === 'health' ? 'diet' : 'health'
  };
  
  const updatedState = {
    ...state,
    dailyLogs: {
      ...state.dailyLogs,
      [date]: updatedDailyLog
    }
  };

  saveState(updatedState as AppState);
  return updatedState as AppState;
};

export const updateNutritionTarget = (
  state: AppState,
  date: string,
  goalId: string,
  amount: number
): AppState => {
  const currentDate = new Date(date);
  
  // Mettre à jour tous les jours à partir de la date actuelle
  const updatedDailyLogs: Record<string, DailyLog> = {};
  
  // Copier tous les logs existants
  Object.entries(state.dailyLogs).forEach(([logDate, log]) => {
    const logDateObj = new Date(logDate);
    if (logDateObj >= currentDate) {
      // Mettre à jour les objectifs pour les jours futurs
      const updatedGoals = log.nutritionGoals.map(goal => {
        if (goal.id === goalId) {
          return {
            ...goal,
            target: {
              ...goal.target,
              [log.activeMode]: amount
            }
          };
        }
        return goal;
      });
      
      // Create a properly typed DailyLog object
      const updatedLog = {
        date: log.date,
        nutritionGoals: updatedGoals,
        activeMode: log.activeMode
      } as DailyLog;
      
      updatedDailyLogs[logDate] = updatedLog;
    } else {
      // Garder les logs passés inchangés
      updatedDailyLogs[logDate] = log;
    }
  });
  
  const updatedState = {
    ...state,
    dailyLogs: updatedDailyLogs
  } as AppState;
  
  saveState(updatedState);
  return updatedState;
};