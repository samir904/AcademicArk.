import { Schema, model } from "mongoose";

const searchSynonymSchema = new Schema(
  {
    keyword: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true
    },

    expandsTo: {
      type: [String], // ["data structure", "data structures"]
      required: true
    },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

searchSynonymSchema.index({ keyword: 1 });

export default model("SearchSynonym", searchSynonymSchema);

/*🗃️ 4️⃣ (Optional but Recommended) SearchSynonym

For non-typo meaning mapping
(DS → Data Structure, COA → Computer Organization)

This prevents overloading typo table.*/
