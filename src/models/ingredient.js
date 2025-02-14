import mongoose from 'mongoose';

const ingredientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  displayName: {
    type: String,
    default: null
  },
  displayPlural: {
    type: String,
    default: null
  },
  plural: {
    type: String,
    default: null
  },
  frozenOrCanned: {
    type: Boolean,
    required: true
  },
  seasons: {
    type: [Number],
    required: true,
    validate: {
      validator: function (array) {
        return array.every(num => num >= 0);
      },
      message: 'Seasons must be positive numbers'
    }
  },
  withPork: {
    type: Boolean,
    default: null
  },
  unbreakable: {
    type: Boolean,
    default: null
  },
  ignoreShoppingList: {
    type: Boolean,
    required: true
  },
  storeShelf: {
    type: Number,
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  measurementUnit: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MeasurementUnit',
    required: true
  },
  grossWeight: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
});

ingredientSchema.statics.findByName = function (name) {
  return this.findOne({ name: name });
};

ingredientSchema.methods.toJSON = function () {
  const obj = this.toObject();

  delete obj.__v;

  if (obj.measurementUnit) {
    obj.measurementUnitName = obj.measurementUnit.name;
  }

  obj.isAvailableNow = obj.seasons.includes(new Date().getMonth() + 1);

  return obj;
};

const Ingredient = mongoose.model('Ingredient', ingredientSchema);

export default Ingredient;