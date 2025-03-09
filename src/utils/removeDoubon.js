import Ingredient from '../models/ingredient.js';

export async function removeDuplicates () {
  const duplicates = await Ingredient.aggregate([
    { $group: { _id: "$name", count: { $sum: 1 }, docs: { $push: "$_id" } } },
    { $match: { count: { $gt: 1 } } }
  ]);

  for (const duplicate of duplicates) {
    // On garde le premier document et on supprime les autres
    // Le premier document (_keep) est préservé car il est probablement le plus ancien
    const [_keep, ...remove] = duplicate.docs;
    console.log('Supprimer tous les documents sauf le premier', _keep)
    // Supprimer tous les documents sauf le premier (_keep)
    await Ingredient.deleteMany({ _id: { $in: remove } });
  }
}