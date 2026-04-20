// models/SubjectMeta.model.js
import mongoose from 'mongoose';

const SubTopicSchema = new mongoose.Schema({
  subTopicId:    { type: String, required: true },
  canonicalName: { type: String, required: true },
  aliases:       [{ type: String }],
}, { _id: false });

const SyllabusTopicSchema = new mongoose.Schema({
  topicId:       { type: String, required: true },
  canonicalName: { type: String, required: true },
  aliases:       [{ type: String }],
  subTopics:     [SubTopicSchema],
}, { _id: false });

const UnitSchema = new mongoose.Schema({
  unitId:         { type: String, required: true },
  unitNumber:     { type: Number, required: true },
  title:          { type: String, required: true },
  syllabusTopics: [SyllabusTopicSchema],
}, { _id: false });

const SubjectMetaSchema = new mongoose.Schema({
  _id:                  { type: String },          // "CN", "DS", "OS"
  name:                 { type: String, required: true },
  code:                 { type: String, required: true }, //here in the code we store the subject like os 
  // models/SubjectMeta.model.js — add this field
paperCodes: {
  type: [String],//here in the paper code  ["BCS401", "KCS401", "RCS401"]  right 
  default: [],
  index: true,
},
// e.g. for OS: ["BCS401", "KCS401", "RCS401"]

 semester: {
  type: [Number],   // array of semesters
  required: true,
  validate: {
    validator: arr => arr.length > 0,
    message: "At least one semester is required"
  }
},
  branch:               [{ type: String }],
  totalUnits:           { type: Number, required: true },
  units:                [UnitSchema],
  analyticsReady:       { type: Boolean, default: false },
  totalPapersAnalysed:  { type: Number,  default: 0 },
  createdAt:            { type: Date, default: Date.now },
  updatedAt:            { type: Date, default: Date.now },
}, {
  _id: false,            // we set _id manually as subject code
  timestamps: false,     // manual control
});

SubjectMetaSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('SubjectMeta', SubjectMetaSchema);