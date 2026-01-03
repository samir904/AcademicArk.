import { Schema,model } from "mongoose";
import mongoose from "mongoose";

const noteSchema=new Schema({
    title:{
        type:String,
        required:true,
        trim:true,
        minlength:[3,"Title must be at least 3 character long"],
        maxlength:[100,"Title must be less than 100 characters"]
    },
    description:{
        type:String,
        required:true,
        trim:true,
        minlength:[10,"Description must be at least 10 character long"],
        maxlength:[500,"Description must be less than 500 characters"]
    },
    subject:{
        type:String,
        required:true,
        trim:true,
        maxlength:[50,"Subject name must be less than 50 character long "]
    },
    course:{
        type:String,
        required:true,
        trim:true,
        enum:["BTECH"],
        default:"BTECH",
        maxlength:[50,"Course name must be less than 50 character"]
    },
    semester:{
        type:Number,
        required:true,
        min:[1,"Semester must be at least 1 "],
        max:[8,"Semester cannot exceed 8 "]
    },
    university:{
        type:String,
        required:true,
        trim:true,
        enum:["AKTU"],
        default:"AKTU"
    },
    uploadedBy:{
        type:Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    fileDetails:{
        public_id:{
            type:String,
            required:true
        },
        secure_url:{
            type:String,
            required:true
        }
    },
    category:{
        type:String,
        enum:["Notes","Important Question","PYQ", "Handwritten Notes"],
        default:"Notes"
    },
    downloads:{
        type:Number,
        default:0,
        min:[0,"Downloads cannot be negative"]
    },
    views: {
        type: Number,
        default: 0,
        min: [0, "Views cannot be negative"]
    },
    viewedBy: [{
        type: Schema.Types.ObjectId,
        ref: "User"
    }],
    rating:[{
        user:{
            type:Schema.Types.ObjectId,
            ref:"User",
            required:true
        },
        rating:{
            type:Number,
            required:true,
            min:[1,"Rating must be at least  1 "],
            max:[5,"Rating cannot exceed 5"]
        },
        review:{
            type:String,
            trim:true,
            maxlength:[200,"Review must be less than 200 characters"]
        }
    }],
    bookmarkedBy:[{
        type:Schema.Types.ObjectId,
        ref:"User"
    }]
},{
    timestamps:true
})

// Indexes for performance
noteSchema.index({subject:1,semester:1});
noteSchema.index({university:1,course:1});
noteSchema.index({uploadedBy:1});

// Virtual for total bookmarks
noteSchema.virtual('totalBookmarks').get(function() {
    return this.bookmarkedBy.length;
});



const Note = mongoose.models.Note || model("Note", noteSchema);

export default Note;