import cron from 'node-cron';
import { removeDuplicates } from '../utils/removeDoubon.js';

cron.schedule('0 0 * * *', async () => {
    console.log('Exécution de la tâche cron pour supprimer les doublons');
    await removeDuplicates();
    console.log('Tâche terminée');
});