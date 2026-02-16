import mongoose from "mongoose";
import slugify from "slugify";
import Note from "../MODELS/note.model.js";
import dotenv from "dotenv";

dotenv.config();

const migrate = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const notes = await Note.find({
      $or: [
        { slug: { $exists: false } },
        { slug: null },
        { seoTitle: { $exists: false } },
        { seoTitle: "" },
        { seoDescription: { $exists: false } },
        { seoDescription: "" }
      ]
    });

    console.log(`Found ${notes.length} notes to update`);

    for (let note of notes) {
      const semester = note.semester?.[0] || "sem";

      const baseSlug = slugify(
        `${note.title}-semester-${semester}-${note.subject}-aktu`,
        { lower: true, strict: true }
      );

      let slug = baseSlug;
      let counter = 1;

      while (await Note.findOne({ slug, _id: { $ne: note._id } })) {
        slug = `${baseSlug}-${counter++}`;
      }

      note.slug = slug;

      let generatedTitle = `${note.title} | AKTU ${note.subject} Sem ${semester} Notes`;
      if (generatedTitle.length > 65) {
        generatedTitle = generatedTitle.substring(0, 62) + "...";
      }
      note.seoTitle = generatedTitle;

      let generatedDesc = `Download ${note.title} for AKTU ${note.subject} semester ${semester}. Notes, PYQ & important questions on AcademicArk.`;
      if (generatedDesc.length > 155) {
        generatedDesc = generatedDesc.substring(0, 152) + "...";
      }
      note.seoDescription = generatedDesc;

      await note.save();
      console.log(`Updated: ${slug}`);
    }

    console.log("Migration completed successfully ✅");
    process.exit();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

migrate();
