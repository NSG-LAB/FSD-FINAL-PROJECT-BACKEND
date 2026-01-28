const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  propertyType: {
    type: String,
    enum: ['apartment', 'house', 'villa', 'townhouse', 'studio'],
    required: true
  },
  age: {
    type: Number,
    required: true
  },
  builUpArea: {
    type: Number,
    required: true
  },
  bedrooms: {
    type: Number,
    required: true
  },
  bathrooms: {
    type: Number,
    required: true
  },
  location: {
    address: String,
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    pincode: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  condition: {
    type: String,
    enum: ['excellent', 'good', 'average', 'needs-work'],
    required: true
  },
  currentValue: {
    type: Number,
    required: true
  },
  features: [
    {
      type: String,
      enum: [
        'garden',
        'balcony',
        'parking',
        'lift',
        'security',
        'gym',
        'pool',
        'community-center',
        'solar-panel',
        'water-storage'
      ]
    }
  ],
  images: [String],
  improvements: [
    {
      category: String,
      description: String,
      estimatedCost: Number,
      potentialROI: Number,
      completedDate: Date
    }
  ],
  recommendations: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Recommendation'
  }],
  estimatedNewValue: {
    type: Number,
    default: 0
  },
  potentialValueIncrease: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'recommended'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Property', propertySchema);
