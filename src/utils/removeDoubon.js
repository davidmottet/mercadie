import Ingredient from '../models/ingredient.js';

export async function removeDuplicates() {
    console.log('removeDuplicates')
  const duplicates = await Ingredient.aggregate([
    { $group: { _id: "$name", count: { $sum: 1 }, docs: { $push: "$_id" } } },
    { $match: { count: { $gt: 1 } } }
  ]);

  for (const duplicate of duplicates) {
    // Garder un document et supprimer les autres
    const [keep, ...remove] = duplicate.docs;
    await Ingredient.deleteMany({ _id: { $in: remove } });
  }
}